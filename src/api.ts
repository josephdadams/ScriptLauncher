import express, { Request, Response } from 'express'
import { Server as HttpServer } from 'http'
import { Socket } from 'socket.io'
import { spawn } from 'child_process'
import { Server as SocketIOServer } from 'socket.io'
import Store from 'electron-store'
import { Notification } from 'electron'

import systeminformation from 'systeminformation'

import fs from 'fs'
import path from 'path'
import os from 'os'

const store = new Store()
const adminPassword = store.get('password')

var systemInfoInterval: NodeJS.Timeout

// Helper function to gather system info
async function getSystemInfo() {
    try {
        const cpu = await systeminformation.cpu()
        const currentLoad = await systeminformation.currentLoad()
        const memory = await systeminformation.mem()
        const networkInterfaces = await systeminformation.networkInterfaces()
        const networkStats = await systeminformation.networkStats()
        const gpu = await systeminformation.graphics()

        return {
            cpu,
            currentLoad,
            memory,
            networkInterfaces,
            networkStats,
            gpu,
        }
    } catch (error) {
        console.error('Error getting system information:', error)
        return null
    }
}

// Helper function to run system commands
function runSystemCommand(
    command: string[],
    successMessage: string,
    socket?: Socket
) {
    const process = spawn(command[0], command.slice(1))

    process.on('close', (code) => {
        if (socket) {
            if (code === 0) {
                socket.emit('command_result', successMessage)
            } else {
                socket.emit('command_result', `Error executing command.`)
            }
        }
    })

    process.on('error', (err) => {
        if (socket) {
            socket.emit(
                'command_result',
                `Error during execution: ${err.message}`
            )
        }
    })
}

// Define the runScript function
export function runScript(
    executable: string,
    args: string,
    stdin: string,
    password: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        if (password !== adminPassword) {
            reject('Error: Invalid admin password.')
            return
        }

        const process = spawn(executable, [...args.split(' ')])

        let output = ''
        let errorOutput = ''

        process.stdin.write(stdin)
        process.stdin.end() // Close the stdin stream

        process.stdout.on('data', (data) => {
            output += data.toString()
        })

        process.stderr.on('data', (data) => {
            errorOutput += data.toString()
        })

        process.on('close', (code) => {
            if (code === 0) {
                resolve(output)
            } else {
                reject(`Error executing script: ${errorOutput}`)
            }
        })

        process.on('error', (err) => {
            reject(`Failed to start process: ${err.message}`)
        })
    })
}

// Function to shutdown the system with a custom time and notification
function shutdownSystem(minutes: number, socket?: Socket): void {
    const platform = process.platform

    let shutdownCommand: string[] = []
    let notificationMessage = `The system will shut down in ${minutes} minutes.`

    if (platform === 'win32') {
        shutdownCommand = [
            'shutdown',
            '/s',
            '/f',
            '/t',
            (minutes * 60).toString(),
        ]
    } else if (platform === 'darwin' || platform === 'linux') {
        shutdownCommand = [
            'sudo',
            'shutdown',
            '-h',
            `+${minutes}`,
            notificationMessage,
        ]
    } else {
        if (socket) {
            socket.emit(
                'command_result',
                'Error: Unsupported platform for shutdown.'
            )
        }
        return
    }

    // Send the shutdown notification (only for Linux/macOS)
    if (platform !== 'win32') {
        const notificationCommand =
            platform === 'darwin'
                ? [
                      'osascript',
                      '-e',
                      `display notification "${notificationMessage}" with title "Shutdown Alert"`,
                  ]
                : ['notify-send', 'Shutdown Alert', notificationMessage]
        runSystemCommand(
            notificationCommand,
            `System will shut down in ${minutes} minutes.`,
            socket
        )
    }

    // Execute the shutdown command
    runSystemCommand(
        shutdownCommand,
        `System will shut down in ${minutes} minutes.`,
        socket
    )
}

// Function to initialize the server and socket.io
export function initializeServer(): HttpServer {
    const app = express()
    const server = new HttpServer(app)
    const io = new SocketIOServer(server)

    app.use(express.json())

    // Socket.io connection handling
    io.on('connection', (socket: Socket) => {
        socket.emit('platform', process.platform)

        // Handle execute event
        socket.on(
            'execute',
            (
                executable: string,
                args: string,
                stdin: string,
                password: string
            ) => {
                runScript(executable, args, stdin, password)
                    .then((output) => {
                        socket.emit('script_result', output)
                    })
                    .catch((error) => {
                        socket.emit('script_result', `Error: ${error}`)
                    })
            }
        )

        // Handle shutdown event with custom time
        socket.on('shutdown', (password: string, time: number) => {
            if (password !== adminPassword) {
                socket.emit('shutdown_result', 'Error: Invalid admin password.')
                return
            }

            socket.emit(
                'shutdown_result',
                `System will shut down in ${time} minutes.`
            )
            shutdownSystem(time, socket) // Trigger system shutdown
        })

        // Handle cancel shutdown
        socket.on('shutdown_cancel', (password: string) => {
            if (password !== adminPassword) {
                socket.emit('shutdown_result', 'Error: Invalid admin password.')
                return
            }

            const platform = process.platform
            let cancelCommand: string[] = []
            if (platform === 'win32') {
                cancelCommand = ['shutdown', '/a']
            } else if (platform === 'darwin' || platform === 'linux') {
                cancelCommand = ['sudo', 'shutdown', '-c']
            }
            runSystemCommand(cancelCommand, 'Shutdown cancelled.', socket)
        })

        // Predefined script: Reboot
        socket.on('reboot', (password: string) => {
            if (password !== adminPassword) {
                socket.emit('command_result', 'Error: Invalid admin password.')
                return
            }

            const rebootCommand =
                process.platform === 'win32'
                    ? ['shutdown', '/r', '/f', '/t', '0']
                    : ['sudo', 'reboot']

            runSystemCommand(rebootCommand, 'System is rebooting...', socket)
        })

        //Predefined script: Lock
        socket.on('lock', (password: string) => {
            if (password !== adminPassword) {
                socket.emit('command_result', 'Error: Invalid admin password.')
                return
            }

            const platform = process.platform
            let lockCommand: string[] = []
            if (platform === 'win32') {
                lockCommand = ['rundll32.exe', 'user32.dll,LockWorkStation']
            } else if (platform === 'darwin') {
                lockCommand = [
                    'osascript',
                    '-e',
                    'tell application "System Events" to keystroke "q" using {control down, command down}',
                ]
            } else if (platform === 'linux') {
                lockCommand = ['gnome-screensaver-command', '-l']
            }

            runSystemCommand(lockCommand, 'System is locking...', socket)
        })

        // Predefined script: Send system alert
        socket.on('sendAlert', (password: string, message: string) => {
            if (password !== adminPassword) {
                socket.emit('command_result', 'Error: Invalid admin password.')
                return
            }

            // Create and show an Electron notification
            const notification = new Notification({
                title: 'ScriptLauncher Alert',
                body: message, // The message passed to the alert
            })

            notification.show() // Display the notification

            // Send a confirmation back to the client via Socket.IO
            socket.emit('command_result', 'System alert sent.')
        })

        socket.on('stopSystemInfo', () => {
            //stops gathering the system info
            clearInterval(systemInfoInterval)
        })

        socket.on('startSystemInfo', () => {
            //starts gathering the system info
            systemInfoInterval = setInterval(async () => {
                const systemInfo = await getSystemInfo()
                if (systemInfo) {
                    io.emit('system_info', systemInfo) // Broadcast to all connected clients
                }
            }, 5000) // Emit every 5 seconds
        })

        socket.on(
            'moveFile',
            async (
                oldPath: string,
                newPath: string,
                copyOnly: boolean,
                password: string
            ) => {
                if (password !== adminPassword) {
                    socket.emit(
                        'command_result',
                        'Error: Invalid admin password.'
                    )
                    return
                }

                try {
                    // Resolve absolute paths
                    const resolvedOldPath = path.resolve(oldPath)
                    const resolvedNewPath = path.resolve(newPath)

                    // Ensure the source file exists
                    if (!fs.existsSync(resolvedOldPath)) {
                        socket.emit(
                            'command_result',
                            'Error: Source file does not exist: ' +
                                resolvedOldPath
                        )
                        return
                    }

                    // Ensure newPath is not a directory
                    if (
                        fs.existsSync(resolvedNewPath) &&
                        fs.lstatSync(resolvedNewPath).isDirectory()
                    ) {
                        socket.emit(
                            'command_result',
                            'Error: Destination path is a directory: ' +
                                resolvedNewPath
                        )
                        return
                    }

                    // OS-specific security checks
                    if (process.platform === 'win32') {
                        // Windows-specific system paths
                        const forbiddenWindowsPaths = [
                            'C:\\Windows\\',
                            'C:\\Program Files\\',
                        ]
                        if (
                            forbiddenWindowsPaths.some(
                                (p) =>
                                    resolvedOldPath.startsWith(p) ||
                                    resolvedNewPath.startsWith(p)
                            )
                        ) {
                            socket.emit(
                                'command_result',
                                'Error: Moving system-critical files is not allowed on Windows: ' +
                                    resolvedOldPath
                            )
                            return
                        }
                    } else {
                        // Unix-based systems: prevent moving root/system-critical files
                        const forbiddenUnixPaths = [
                            '/etc/',
                            '/sys/',
                            '/proc/',
                            '/dev/',
                            '/bin/',
                            '/usr/bin/',
                        ]
                        if (
                            forbiddenUnixPaths.some(
                                (p) =>
                                    resolvedOldPath.startsWith(p) ||
                                    resolvedNewPath.startsWith(p)
                            )
                        ) {
                            socket.emit(
                                'command_result',
                                'Error: Moving system-critical files is not allowed on Unix-like systems: ' +
                                    resolvedOldPath
                            )
                            return
                        }
                    }

                    if (copyOnly) {
                        // Copy file instead of moving
                        await fs.promises.copyFile(
                            resolvedOldPath,
                            resolvedNewPath
                        )
                        socket.emit(
                            'command_result',
                            'File copied successfully: ' + resolvedNewPath
                        )
                    } else {
                        // Move the file
                        const { moveFile } = await import('move-file')
                        await moveFile(resolvedOldPath, resolvedNewPath)
                        socket.emit(
                            'command_result',
                            'File moved successfully: ' + resolvedNewPath
                        )
                    }
                } catch (err: any) {
                    if (process.platform === 'win32' && err.code === 'EPERM') {
                        socket.emit(
                            'command_result',
                            'Error: Permission denied (Windows EPERM). Try running as Administrator.'
                        )
                    } else {
                        socket.emit(
                            'command_result',
                            `Error processing file: ${err.message}`
                        )
                    }
                }
            }
        )

        socket.on(
            'moveDatedFileInFolder',
            async (
                sourceFolderPath: string,
                newestOrOldest: string,
                destFolderPath: string,
                fileName: string,
                password: string
            ) => {
                if (password !== adminPassword) {
                    socket.emit(
                        'command_result',
                        'Error: Invalid admin password.'
                    )
                    return
                }

                try {
                    // Resolve absolute paths
                    //if destFolderPath is blank, use the sourceFolderPath
                    if (destFolderPath === '') {
                        destFolderPath = sourceFolderPath
                    }

                    const resolvedSourceFolderPath =
                        path.resolve(sourceFolderPath)
                    const resolvedDestFolderPath = path.resolve(destFolderPath)

                    // Ensure the source folder exists
                    if (!fs.existsSync(resolvedSourceFolderPath)) {
                        socket.emit(
                            'command_result',
                            'Error: Source folder does not exist: ' +
                                resolvedSourceFolderPath
                        )
                        return
                    }

                    // OS-specific security checks
                    if (process.platform === 'win32') {
                        // Windows-specific system paths
                        const forbiddenWindowsPaths = [
                            'C:\\Windows\\',
                            'C:\\Program Files\\',
                        ]
                        if (
                            forbiddenWindowsPaths.some(
                                (p) =>
                                    resolvedSourceFolderPath.startsWith(p) ||
                                    resolvedDestFolderPath.startsWith(p)
                            )
                        ) {
                            socket.emit(
                                'command_result',
                                'Error: Moving system-critical files is not allowed on Windows: ' +
                                    resolvedSourceFolderPath
                            )
                            return
                        }
                    } else {
                        // Unix-based systems: prevent moving root/system-critical files
                        const forbiddenUnixPaths = [
                            '/etc/',
                            '/sys/',
                            '/proc/',
                            '/dev/',
                            '/bin/',
                            '/usr/bin/',
                        ]
                        if (
                            forbiddenUnixPaths.some(
                                (p) =>
                                    resolvedSourceFolderPath.startsWith(p) ||
                                    resolvedDestFolderPath.startsWith(p)
                            )
                        ) {
                            socket.emit(
                                'command_result',
                                'Error: Moving system-critical files is not allowed on Unix-like systems: ' +
                                    resolvedSourceFolderPath
                            )
                            return
                        }
                    }

                    //get the list of files in the source folder
                    const files = fs.readdirSync(resolvedSourceFolderPath)

                    // Sort the files by modification date
                    files.sort((a, b) => {
                        return (
                            fs
                                .statSync(
                                    path.join(resolvedSourceFolderPath, b)
                                )
                                .mtime.getTime() -
                            fs
                                .statSync(
                                    path.join(resolvedSourceFolderPath, a)
                                )
                                .mtime.getTime()
                        )
                    })

                    if (newestOrOldest == 'oldest') {
                        files.reverse()
                    }

                    if (files.length === 0) {
                        socket.emit(
                            'command_result',
                            'Error: No files found in source folder: ' +
                                resolvedSourceFolderPath
                        )
                        return
                    }

                    //get the first file
                    const firstFile = files[0]

                    //check the filename has an extension and if not, add the extension from firstFile
                    if (path.extname(fileName) === '') {
                        fileName = fileName + path.extname(firstFile)
                    }

                    // Resolve the full path of the selected file
                    const resolvedSourceFilePath = path.join(
                        resolvedSourceFolderPath,
                        firstFile
                    )

                    // Ensure the source file actually exists before moving
                    if (!fs.existsSync(resolvedSourceFilePath)) {
                        throw new Error(
                            `Source file does not exist: ${resolvedSourceFilePath}`
                        )
                    }

                    // Ensure the destination folder exists (create it if missing)
                    if (!fs.existsSync(resolvedDestFolderPath)) {
                        fs.mkdirSync(resolvedDestFolderPath, {
                            recursive: true,
                        })
                    }

                    //sanitize the new filename
                    //remove any characters that are not alphanumeric, underscore, or hyphen
                    fileName = fileName.replace(/[^a-zA-Z0-9_\-\.]/g, '')
                    //remove any leading or trailing spaces
                    fileName = fileName.trim()

                    // 🚨 Prevent Overwriting: Generate a unique filename if needed
                    let resolvedDestFilePath = path.join(
                        resolvedDestFolderPath,
                        fileName
                    )
                    let fileBase = path.basename(
                        fileName,
                        path.extname(fileName)
                    )
                    let fileExt = path.extname(fileName)
                    let counter = 1

                    while (fs.existsSync(resolvedDestFilePath)) {
                        // Append _1, _2, _3, etc. to make the filename unique
                        resolvedDestFilePath = path.join(
                            resolvedDestFolderPath,
                            `${fileBase}_${counter}${fileExt}`
                        )
                        counter++
                    }

                    // Move the file
                    const { moveFile } = await import('move-file')
                    await moveFile(resolvedSourceFilePath, resolvedDestFilePath)

                    socket.emit(
                        'command_result',
                        'File moved successfully: ' + resolvedDestFilePath
                    )
                } catch (err: any) {
                    socket.emit(
                        'command_result',
                        `Error processing file: ${err.message}`
                    )
                    return
                }
            }
        )

        socket.on(
            'moveDatedFileInFolderWithExtension',
            async (
                sourceFolderPath: string,
                newestOrOldest: string,
                fileExtension: string,
                destFolderPath: string,
                fileName: string,
                password: string
            ) => {
                if (password !== adminPassword) {
                    socket.emit(
                        'command_result',
                        'Error: Invalid admin password.'
                    )
                    return
                }

                try {
                    // Resolve absolute paths
                    //if destFolderPath is blank, use the sourceFolderPath
                    if (destFolderPath === '') {
                        destFolderPath = sourceFolderPath
                    }

                    const resolvedSourceFolderPath =
                        path.resolve(sourceFolderPath)
                    const resolvedDestFolderPath = path.resolve(destFolderPath)

                    // Ensure the source folder exists
                    if (!fs.existsSync(resolvedSourceFolderPath)) {
                        socket.emit(
                            'command_result',
                            'Error: Source folder does not exist: ' +
                                resolvedSourceFolderPath
                        )
                        return
                    }

                    // OS-specific security checks
                    if (process.platform === 'win32') {
                        // Windows-specific system paths
                        const forbiddenWindowsPaths = [
                            'C:\\Windows\\',
                            'C:\\Program Files\\',
                        ]
                        if (
                            forbiddenWindowsPaths.some(
                                (p) =>
                                    resolvedSourceFolderPath.startsWith(p) ||
                                    resolvedDestFolderPath.startsWith(p)
                            )
                        ) {
                            socket.emit(
                                'command_result',
                                'Error: Moving system-critical files is not allowed on Windows: ' +
                                    resolvedSourceFolderPath
                            )
                            return
                        }
                    } else {
                        // Unix-based systems: prevent moving root/system-critical files
                        const forbiddenUnixPaths = [
                            '/etc/',
                            '/sys/',
                            '/proc/',
                            '/dev/',
                            '/bin/',
                            '/usr/bin/',
                        ]
                        if (
                            forbiddenUnixPaths.some(
                                (p) =>
                                    resolvedSourceFolderPath.startsWith(p) ||
                                    resolvedDestFolderPath.startsWith(p)
                            )
                        ) {
                            socket.emit(
                                'command_result',
                                'Error: Moving system-critical files is not allowed on Unix-like systems: ' +
                                    resolvedSourceFolderPath
                            )
                            return
                        }
                    }

                    //get the list of files in the source folder, with the specified extension
                    const files = fs
                        .readdirSync(resolvedSourceFolderPath)
                        .filter((file) => path.extname(file) === fileExtension)

                    // Sort the files by modification date
                    files.sort((a, b) => {
                        return (
                            fs
                                .statSync(
                                    path.join(resolvedSourceFolderPath, b)
                                )
                                .mtime.getTime() -
                            fs
                                .statSync(
                                    path.join(resolvedSourceFolderPath, a)
                                )
                                .mtime.getTime()
                        )
                    })

                    if (newestOrOldest == 'oldest') {
                        files.reverse()
                    }

                    if (files.length === 0) {
                        socket.emit(
                            'command_result',
                            'Error: No files found in source folder: ' +
                                resolvedSourceFolderPath
                        )
                        return
                    }

                    //get the first file
                    const firstFile = files[0]

                    //sanitize the new filename
                    //remove any characters that are not alphanumeric, underscore, or hyphen
                    fileName = fileName.replace(/[^a-zA-Z0-9_\-\.]/g, '')
                    //remove any leading or trailing spaces
                    fileName = fileName.trim()

                    //check the filename has an extension and if not, add the extension from firstFile
                    if (path.extname(fileName) === '') {
                        fileName = fileName + path.extname(firstFile)
                    }

                    // Resolve the full path of the selected file
                    const resolvedSourceFilePath = path.join(
                        resolvedSourceFolderPath,
                        firstFile
                    )

                    // Ensure the source file actually exists before moving
                    if (!fs.existsSync(resolvedSourceFilePath)) {
                        throw new Error(
                            `Source file does not exist: ${resolvedSourceFilePath}`
                        )
                    }

                    // Ensure the destination folder exists (create it if missing)
                    if (!fs.existsSync(resolvedDestFolderPath)) {
                        fs.mkdirSync(resolvedDestFolderPath, {
                            recursive: true,
                        })
                    }

                    // 🚨 Prevent Overwriting: Generate a unique filename if needed
                    let resolvedDestFilePath = path.join(
                        resolvedDestFolderPath,
                        fileName
                    )
                    let fileBase = path.basename(
                        fileName,
                        path.extname(fileName)
                    )
                    let fileExt = path.extname(fileName)
                    let counter = 1

                    while (fs.existsSync(resolvedDestFilePath)) {
                        // Append _1, _2, _3, etc. to make the filename unique
                        resolvedDestFilePath = path.join(
                            resolvedDestFolderPath,
                            `${fileBase}_${counter}${fileExt}`
                        )
                        counter++
                    }

                    // Move the file
                    const { moveFile } = await import('move-file')
                    await moveFile(resolvedSourceFilePath, resolvedDestFilePath)

                    socket.emit(
                        'command_result',
                        'File moved successfully: ' + resolvedDestFilePath
                    )
                } catch (err: any) {
                    socket.emit(
                        'command_result',
                        `Error processing file: ${err.message}`
                    )
                    return
                }
            }
        )

        socket.on('disconnect', () => {})
    })

    // Handle graceful shutdown to clear the interval when the server stops
    server.on('close', () => {
        clearInterval(systemInfoInterval)
        console.log('System info interval cleared')
    })

    // Example express route for health check
    app.get('/', (req, res) => {
        res.send('ScriptLauncher API is running')
    })

    return server
}
