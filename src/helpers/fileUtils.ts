// --- helpers/fileUtils.ts ---
import fs from 'fs'
import path from 'path'
import { Socket } from 'socket.io'

import { EVENTS } from './events.js'

export function ensureDir(dir: string) {
    fs.mkdirSync(dir, { recursive: true })
}

export function isRegularFile(fullPath: string) {
    try {
        return fs.statSync(fullPath).isFile()
    } catch {
        return false
    }
}

export function sanitizeFilename(inputPath: string): string {
    const dir = path.dirname(inputPath)
    let base = path.basename(inputPath)

    base = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    if (base === '.' || base === '..') {
        base = '_file'
    }

    if (process.platform === 'win32') {
        const reserved = [
            'CON',
            'PRN',
            'AUX',
            'NUL',
            'COM1',
            'COM2',
            'COM3',
            'COM4',
            'COM5',
            'COM6',
            'COM7',
            'COM8',
            'COM9',
            'LPT1',
            'LPT2',
            'LPT3',
            'LPT4',
            'LPT5',
            'LPT6',
            'LPT7',
            'LPT8',
            'LPT9',
        ]
        const name = path.parse(base).name.toUpperCase()
        const ext = path.extname(base)
        if (reserved.includes(name)) {
            base = `_${name}${ext}`
        }
    }

    return path.join(dir, base)
}

export function isPathForbidden(p: string): boolean {
    const forbidden =
        process.platform === 'win32'
            ? ['C:\\Windows\\', 'C:\\Program Files\\']
            : ['/etc/', '/sys/', '/proc/', '/dev/', '/bin/', '/usr/bin/']
    return forbidden.some((f) => p.startsWith(f))
}

export function getLatestFile(
    files: string[],
    folderPath: string,
    newestOrOldest: 'newest' | 'oldest'
): string | undefined {
    const sorted = files
        .map((file) => {
            const fullPath = path.join(folderPath, file)
            try {
                const stats = fs.statSync(fullPath)
                return {
                    file,
                    mtime: stats.mtimeMs,
                }
            } catch {
                return null
            }
        })
        .filter(Boolean)
        .sort((a, b) => {
            return newestOrOldest === 'newest'
                ? b!.mtime - a!.mtime
                : a!.mtime - b!.mtime
        })

    return sorted[0]?.file
}

// Builds a collision-free destination path, lightly sanitizing the leaf
// filename (never the folder). Shared by every move/copy path.
export function generateUniqueFilePath(
    destFolder: string,
    fileName: string
): string {
    const parsed = path.parse(fileName)
    const ext = parsed.ext
    const base = parsed.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || '_file'

    let candidatePath = path.join(destFolder, `${base}${ext}`)
    let count = 1
    while (fs.existsSync(candidatePath)) {
        candidatePath = path.join(destFolder, `${base}_${count}${ext}`)
        count++
    }

    return candidatePath
}

export function getFileSizeInMB(filePath: string): number {
    const stats = fs.statSync(filePath)
    return stats.size / (1024 * 1024) // convert bytes to MB
}

export function isFileLargerThan(filePath: string, sizeInMB: number): boolean {
    return getFileSizeInMB(filePath) > sizeInMB
}

export async function moveDatedFile({
    sourceFolderPath,
    destFolderPath,
    newestOrOldest,
    fileExtension,
    fileName,
    copyOnly,
    socket,
}: {
    sourceFolderPath: string
    destFolderPath: string
    newestOrOldest: 'newest' | 'oldest'
    fileExtension?: string
    fileName: string
    copyOnly: boolean
    socket: Socket
}) {
    console.log(`[moveDatedFile] Starting file move operation...`)
    console.log(`[moveDatedFile] Parameters:`, {
        sourceFolderPath,
        destFolderPath,
        newestOrOldest,
        fileExtension,
        fileName,
        copyOnly,
    })

    const resolvedSource = path.resolve(sourceFolderPath)
    console.log(`[moveDatedFile] Resolved source: ${resolvedSource}`)
    const resolvedDest = path.resolve(destFolderPath || sourceFolderPath)
    console.log(`[moveDatedFile] Resolved destination: ${resolvedDest}`)

    if (!fs.existsSync(resolvedSource)) {
        const errorObj = {
            command: 'moveDatedFile',
            error: `Source folder not found: ${resolvedSource}`,
        }
        socket?.emit(EVENTS.COMMAND_RESULT, errorObj)
        return
    }

    if (isPathForbidden(resolvedSource) || isPathForbidden(resolvedDest)) {
        const errorObj = {
            command: 'moveDatedFile',
            error: `Path is forbidden: ${resolvedSource} or ${resolvedDest}`,
        }
        socket?.emit(EVENTS.COMMAND_RESULT, errorObj)
        return
    }

    console.log(`[moveDatedFile] Searching for files in ${resolvedSource}...`)
    const files = fs.readdirSync(resolvedSource).filter((f) => {
        //filter by fileExtension if provided
        if (
            fileExtension &&
            fileExtension !== '' &&
            fileExtension !== 'undefined'
        ) {
            return path.extname(f) === fileExtension
        }
        return true
    })

    console.log(`[moveDatedFile] Found files in ${resolvedSource}:`, files)

    const firstFile = getLatestFile(files, resolvedSource, newestOrOldest)
    if (!firstFile) {
        console.log(`[moveDatedFile] No matching files found.`)
        const errorObj = {
            command: 'moveDatedFile',
            error: `No matching files found in ${resolvedSource}`,
        }
        socket?.emit(EVENTS.COMMAND_RESULT, errorObj)
        return
    }

    const sourceFilePath = path.join(resolvedSource, firstFile)
    const ext = path.extname(firstFile)

    let newFileName = sanitizeFilename(fileName)
    console.log(`[moveDatedFile] Moving file: ${firstFile} to ${newFileName}`)

    if (path.extname(newFileName) === '') {
        newFileName += ext
    }

    if (!fs.existsSync(resolvedDest)) {
        console.log(
            `[moveDatedFile] Creating destination folder: ${resolvedDest}`
        )
        fs.mkdirSync(resolvedDest, { recursive: true })
    }

    const destFilePath = generateUniqueFilePath(resolvedDest, newFileName)
    console.log(
        `[moveDatedFile] Moving file: ${sourceFilePath} to ${destFilePath}`
    )

    await moveFile(sourceFilePath, destFilePath, copyOnly, socket)
}

export function sanitizeUserPath(p: string) {
    if (typeof p !== 'string') throw new Error('Expected string path')
    // Strip one pair of surrounding quotes and trim whitespace
    const unquoted = p.trim().replace(/^["'](.*)["']$/, '$1')
    // Normalize (keeps drive letters and UNC)
    return process.platform === 'win32'
        ? path.win32.normalize(unquoted)
        : path.normalize(unquoted)
}

export async function moveFile(
    source: string,
    dest: string,
    copyOnly: boolean,
    socket: any
): Promise<void> {
    // Sanitize/normalize inputs (defense in depth)
    const cleanSource = sanitizeUserPath(source)
    const cleanDest = sanitizeUserPath(dest)

    // Enforce forbidden-path protection at the lowest layer so every
    // command that moves/copies files is covered, not just moveDatedFile.
    if (isPathForbidden(cleanSource) || isPathForbidden(cleanDest)) {
        throw new Error(`Path is forbidden: ${cleanSource} or ${cleanDest}`)
    }

    const destFolder = path.dirname(cleanDest)
    const fileName = path.basename(cleanDest)

    // Make sure the destination directory exists
    ensureDir(destFolder)

    // Build a collision-free path (and lightly sanitize filename)
    const uniqueDest = generateUniqueFilePath(destFolder, fileName)

    try {
        if (copyOnly) {
            const fsx = await import('fs-extra')
            await fsx.copy(cleanSource, uniqueDest)
            socket?.emit(EVENTS.COMMAND_RESULT, {
                command: 'moveFile',
                status: 'ok',
                result: `File copied successfully: ${uniqueDest}`,
            })
        } else {
            // Avoid name shadowing with this function
            const { moveFile: moveFileLib } = await import('move-file')
            console.log(
                `[moveFile] Moving file: ${cleanSource} to ${uniqueDest}`
            )
            await moveFileLib(cleanSource, uniqueDest)
            console.log(`[moveFile] File moved successfully: ${uniqueDest}`)
            socket?.emit(EVENTS.COMMAND_RESULT, {
                command: 'moveFile',
                status: 'ok',
                result: `File moved successfully: ${uniqueDest}`,
            })
        }
    } catch (err: any) {
        const msg = `Error ${copyOnly ? 'copying' : 'moving'} file: ${err?.message || err}`
        console.error(msg)
        // If you want ScriptLauncher to surface the error immediately, emit it:
        // socket?.emit(EVENTS.COMMAND_RESULT, { command:'moveFile', status:'error', result: msg })
        throw new Error(msg)
    }
}

export async function moveFiles(
    sourceFolder: string,
    destFolder: string,
    fileExtension: string,
    copyOnly: boolean,
    socket: Socket
): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.readdir(sourceFolder, (err, files) => {
            if (err) {
                reject(`Error reading source folder: ${err.message}`)
                return
            }

            // Filter files by the given file extension
            const filteredFiles = files.filter((file) =>
                file.toLowerCase().endsWith(fileExtension.toLowerCase())
            )

            const movePromises = filteredFiles.map((file) => {
                const sourcePath = path.join(sourceFolder, file)
                const destPath = path.join(destFolder, file)
                return moveFile(sourcePath, destPath, copyOnly, socket).catch(
                    (err: Error) => {
                        console.error(
                            `Error moving file ${file}: ${err.message}`
                        )
                    }
                )
            })

            Promise.all(movePromises)
                .then(() => {
                    console.log('All matching files moved successfully.')
                    resolve()
                })
                .catch((err: Error) => {
                    console.error(`Error moving files: ${err.message}`)
                    reject(err)
                })
        })
    })
}
