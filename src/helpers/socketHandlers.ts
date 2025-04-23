// --- helpers/socketHandlers.ts ---
import { Socket, Server as SocketIOServer } from 'socket.io'
import { Notification } from 'electron'
import { EVENTS, checkPassword } from './generalUtils.js'
import {
    isPathForbidden,
    getLatestFile,
    moveDatedFile,
    moveFile,
    moveFiles,
    sanitizeFilename,
    getFileSizeInMB,
} from './fileUtils.js'
import {
    runScript,
    getSystemInfo,
    getInstalledFontFamilies,
    runSystemCommand,
    shutdownSystem,
} from './systemUtils.js'

import fs from 'fs'
import path from 'path'

let systemInfoInterval: NodeJS.Timeout | undefined

export function registerSocketHandlers(io: SocketIOServer) {
    io.on('connection', (socket: Socket) => {
        socket.emit(EVENTS.PLATFORM, process.platform)

        socket.on('execute', (executable, args, stdin, password) => {
            runScript(executable, args, stdin, password)
                .then((output) => socket.emit(EVENTS.SCRIPT_RESULT, output))
                .catch((error) =>
                    socket.emit(EVENTS.SCRIPT_RESULT, `Error: ${error}`)
                )
        })

        socket.on('getFonts', async () => {
            const fonts = await getInstalledFontFamilies()
            socket.emit(EVENTS.FONT_LIST, fonts)
        })

        socket.on('shutdown', (password: string, time: number) => {
            if (!checkPassword(socket, password, EVENTS.SHUTDOWN_RESULT)) return
            socket.emit(
                EVENTS.SHUTDOWN_RESULT,
                `System will shut down in ${time} minutes.`
            )
            shutdownSystem(time, socket)
        })

        socket.on('shutdown_cancel', (password: string) => {
            if (!checkPassword(socket, password, EVENTS.SHUTDOWN_RESULT)) return
            const cancelCommand =
                process.platform === 'win32'
                    ? ['shutdown', '/a']
                    : ['sudo', 'shutdown', '-c']
            runSystemCommand(cancelCommand, 'Shutdown cancelled.', socket)
        })

        socket.on('reboot', (password: string) => {
            if (!checkPassword(socket, password)) return
            const rebootCommand =
                process.platform === 'win32'
                    ? ['shutdown', '/r', '/f', '/t', '0']
                    : ['sudo', 'reboot']
            runSystemCommand(rebootCommand, 'System is rebooting...', socket)
        })

        socket.on('lock', (password: string) => {
            if (!checkPassword(socket, password)) return
            const lockCommand =
                process.platform === 'win32'
                    ? ['rundll32.exe', 'user32.dll,LockWorkStation']
                    : process.platform === 'darwin'
                      ? [
                            'osascript',
                            '-e',
                            'tell application "System Events" to keystroke "q" using {control down, command down}',
                        ]
                      : ['gnome-screensaver-command', '-l']
            runSystemCommand(lockCommand, 'System is locking...', socket)
        })

        socket.on('sendAlert', (password: string, message: string) => {
            if (!checkPassword(socket, password)) return
            new Notification({
                title: 'ScriptLauncher Alert',
                body: message,
            }).show()
            socket.emit(EVENTS.COMMAND_RESULT, 'System alert sent.')
        })

        socket.on('startSystemInfo', () => {
            clearInterval(systemInfoInterval)
            systemInfoInterval = setInterval(async () => {
                const systemInfo = await getSystemInfo()
                if (systemInfo) io.emit(EVENTS.SYSTEM_INFO, systemInfo)
            }, 5000)
        })

        socket.on('stopSystemInfo', () => stopSystemInfoInterval())

        socket.on(
            'moveDatedFileInFolder',
            async (src, order, dest, name, password) => {
                if (!checkPassword(socket, password)) return
                await moveDatedFile({
                    sourceFolderPath: src,
                    destFolderPath: dest,
                    newestOrOldest: order,
                    fileName: name,
                    socket,
                })
            }
        )

        socket.on(
            'moveDatedFileInFolderWithExtension',
            async (src, order, ext, dest, name, password) => {
                if (!checkPassword(socket, password)) return
                await moveDatedFile({
                    sourceFolderPath: src,
                    destFolderPath: dest,
                    newestOrOldest: order,
                    fileExtension: ext,
                    fileName: name,
                    socket,
                })
            }
        )

        socket.on(
            'moveFileBasedOnSize',
            async (moveObj: any, password: string) => {
                console.log(
                    `[${new Date().toISOString()}] Received move request: ${JSON.stringify(moveObj)}`
                )

                if (
                    !moveObj ||
                    !moveObj.sourceFolderPath ||
                    !moveObj.destFolderPathLarger ||
                    !moveObj.destFolderPathSmaller ||
                    !moveObj.sizeThreshold
                ) {
                    socket.emit(
                        'command_result',
                        'Error: Invalid move object structure.'
                    )
                    return
                }

                if (!checkPassword(socket, password)) return

                if (moveObj.selectBySize === true) {
                    console.log(
                        `[${new Date().toISOString()}] Moving files based on size.`
                    )

                    let fileSizes = []
                    try {
                        const files = fs.readdirSync(moveObj.sourceFolderPath)
                        console.log(
                            `[${new Date().toISOString()}] Found ${files.length} files in source folder.`
                        )

                        fileSizes = files.map((file) => {
                            const fullPath = path.join(
                                moveObj.sourceFolderPath,
                                file
                            )
                            const size = getFileSizeInMB(fullPath)
                            console.log(
                                `[${new Date().toISOString()}] File: ${file}, Size: ${size} MB`
                            )
                            return { file, size }
                        })
                    } catch (err) {
                        socket.emit(
                            'command_result',
                            `Error reading files: ${err}`
                        )
                        return
                    }

                    let filteredLargerFiles = fileSizes
                        .filter((f) => f.size >= moveObj.sizeThreshold)
                        .map((f) => f.file)
                    let filteredSmallerFiles = fileSizes
                        .filter((f) => f.size < moveObj.sizeThreshold)
                        .map((f) => f.file)

                    if (moveObj.fileExtension && moveObj.fileExtension !== '') {
                        const ext = moveObj.fileExtension.toLowerCase()
                        filteredLargerFiles = filteredLargerFiles.filter(
                            (file) => path.extname(file).toLowerCase() === ext
                        )
                        filteredSmallerFiles = filteredSmallerFiles.filter(
                            (file) => path.extname(file).toLowerCase() === ext
                        )
                    }

                    if (
                        moveObj.newestOrOldest &&
                        moveObj.newestOrOldest !== ''
                    ) {
                        const newestOrOldest = moveObj.newestOrOldest
                        const firstLargestFile = getLatestFile(
                            filteredLargerFiles,
                            moveObj.sourceFolderPath,
                            newestOrOldest
                        )
                        if (firstLargestFile)
                            filteredLargerFiles = [firstLargestFile]

                        const firstSmallestFile = getLatestFile(
                            filteredSmallerFiles,
                            moveObj.sourceFolderPath,
                            newestOrOldest
                        )
                        if (firstSmallestFile)
                            filteredSmallerFiles = [firstSmallestFile]
                    }

                    for (const file of filteredLargerFiles) {
                        try {
                            const source = path.join(
                                moveObj.sourceFolderPath,
                                file
                            )
                            const dest = path.join(
                                moveObj.destFolderPathLarger,
                                file
                            )
                            await moveFile(source, dest, socket)
                            console.log(
                                `[${new Date().toISOString()}] Moved large file: ${file} -> ${dest}`
                            )
                        } catch (err) {
                            socket.emit(
                                'command_result',
                                `Error moving large file ${file}: ${err}`
                            )
                        }
                    }

                    for (const file of filteredSmallerFiles) {
                        try {
                            const source = path.join(
                                moveObj.sourceFolderPath,
                                file
                            )
                            const dest = path.join(
                                moveObj.destFolderPathSmaller,
                                file
                            )
                            await moveFile(source, dest, socket)
                            console.log(
                                `[${new Date().toISOString()}] Moved small file: ${file} -> ${dest}`
                            )
                        } catch (err) {
                            socket.emit(
                                'command_result',
                                `Error moving small file ${file}: ${err}`
                            )
                        }
                    }
                } else {
                    moveFiles(
                        moveObj.sourceFolderPath,
                        moveObj.destFolderPath,
                        moveObj.fileExtension,
                        socket
                    )
                }
            }
        )

        socket.on('focusApp', (appName: string, password: string) => {
            if (!checkPassword(socket, password)) return
            const focusCommand =
                process.platform === 'win32'
                    ? [
                          'powershell',
                          '-command',
                          `& { $p=Get-Process -Name '${appName}' -ErrorAction SilentlyContinue; if ($p) { $h=$p.MainWindowHandle; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinAPI { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }'; [WinAPI]::SetForegroundWindow($h) } else { Start-Process '${appName}' } }`,
                      ]
                    : process.platform === 'darwin'
                      ? [
                            'osascript',
                            '-e',
                            `tell application "${appName}" to activate`,
                        ]
                      : ['sh', '-c', `wmctrl -a "${appName}" || ${appName} &`]
            runSystemCommand(focusCommand, `Focusing on ${appName}...`, socket)
        })

        socket.on('quitApp', (appName: string, password: string) => {
            if (!checkPassword(socket, password)) return
            const quitCommand =
                process.platform === 'win32'
                    ? ['taskkill', '/F', '/IM', `${appName}.exe`]
                    : process.platform === 'darwin'
                      ? [
                            'osascript',
                            '-e',
                            `tell application "${appName}" to quit`,
                        ]
                      : ['pkill', '-f', appName]
            runSystemCommand(quitCommand, `Quitting ${appName}...`, socket)
        })
    })
}

export function stopSystemInfoInterval() {
    if (systemInfoInterval) {
        clearInterval(systemInfoInterval)
        systemInfoInterval = undefined
        console.log(
            `[${new Date().toISOString()}] System info interval cleared`
        )
    }
}
