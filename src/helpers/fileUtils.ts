// --- helpers/fileUtils.ts ---
import fs from 'fs'
import path from 'path'
import { Socket } from 'socket.io'

import { EVENTS } from './generalUtils.js'

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
    folder: string,
    newestOrOldest: 'newest' | 'oldest'
): string | null {
    if (files.length === 0) return null

    files.sort((a, b) => {
        return (
            fs.statSync(path.join(folder, b)).mtime.getTime() -
            fs.statSync(path.join(folder, a)).mtime.getTime()
        )
    })

    if (newestOrOldest === 'oldest') files.reverse()

    return files[0] || null
}

export function generateUniqueFilePath(
    destFolder: string,
    fileName: string
): string {
    const ext = path.extname(fileName)
    const base = path.basename(fileName, ext)

    let count = 1
    let candidatePath = path.join(destFolder, fileName)

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
    socket,
}: {
    sourceFolderPath: string
    destFolderPath: string
    newestOrOldest: 'newest' | 'oldest'
    fileExtension?: string
    fileName: string
    socket: Socket
}) {
    const resolvedSource = path.resolve(sourceFolderPath)
    const resolvedDest = path.resolve(destFolderPath || sourceFolderPath)

    if (!fs.existsSync(resolvedSource)) {
        const errorObj = {
            command: 'moveDatedFile',
            error: `Source folder not found: ${resolvedSource}`,
        }
        socket.emit(EVENTS.COMMAND_RESULT, errorObj)
        return
    }

    if (isPathForbidden(resolvedSource) || isPathForbidden(resolvedDest)) {
        const errorObj = {
            command: 'moveDatedFile',
            error: `Path is forbidden: ${resolvedSource} or ${resolvedDest}`,
        }
        socket.emit(EVENTS.COMMAND_RESULT, errorObj)
        return
    }

    const files = fs.readdirSync(resolvedSource).filter((f) => {
        return !fileExtension || path.extname(f) === fileExtension
    })

    const firstFile = getLatestFile(files, resolvedSource, newestOrOldest)
    if (!firstFile) {
        const errorObj = {
            command: 'moveDatedFile',
            error: `No matching files found in ${resolvedSource}`,
        }
        socket.emit(EVENTS.COMMAND_RESULT, errorObj)
        return
    }

    const sourceFilePath = path.join(resolvedSource, firstFile)
    const ext = path.extname(firstFile)

    let newFileName = sanitizeFilename(fileName)
    if (path.extname(newFileName) === '') {
        newFileName += ext
    }

    if (!fs.existsSync(resolvedDest)) {
        fs.mkdirSync(resolvedDest, { recursive: true })
    }

    const destFilePath = generateUniqueFilePath(resolvedDest, newFileName)

    const { moveFile } = await import('move-file')
    await moveFile(sourceFilePath, destFilePath)

    socket.emit(
        EVENTS.COMMAND_RESULT,
        `File moved successfully: ${destFilePath}`
    )
}

export async function moveFile(
    source: string,
    dest: string,
    socket: Socket
): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const { moveFile } = await import('move-file')

        moveFile(source, dest)
            .then(() => {
                let fileMovedObj = {
                    command: 'moveFile',
                    status: 'ok',
                    result: `File moved successfully: ${dest}`,
                }
                socket.emit(EVENTS.COMMAND_RESULT, fileMovedObj)
                resolve()
            })
            .catch((err: Error) => {
                let fileMovedObj = {
                    command: 'moveFile',
                    status: 'error',
                    result: `Error moving file: ${err.message}`,
                }
                socket.emit(EVENTS.COMMAND_RESULT, fileMovedObj)
                reject(err)
            })
    })
}

export async function moveFiles(
    sourceFolder: string,
    destFolder: string,
    fileExtension: string,
    socket: Socket
): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.readdir(
            sourceFolder,
            (err: NodeJS.ErrnoException | null, files: string[]) => {
                if (err) {
                    reject(`Error reading source folder: ${err.message}`)
                    return
                }
                const movePromises = files.map((file) => {
                    const sourcePath = path.join(sourceFolder, file)
                    const destPath = path.join(destFolder, file)
                    return moveFile(sourcePath, destPath, socket).catch(
                        (err: Error) => {
                            console.error(
                                `Error moving file ${file}: ${err.message}`
                            )
                        }
                    )
                })
                Promise.all(movePromises)
                    .then(() => {
                        console.log('All files moved successfully.')
                        resolve()
                    })
                    .catch((err: Error) => {
                        console.error(`Error moving files: ${err.message}`)
                        reject(err)
                    })
            }
        )
    })
}
