import express, { Request, Response } from 'express'
import { Server as HttpServer } from 'http'
import { Socket } from 'socket.io'
import { spawn } from 'child_process'
import { Server as SocketIOServer } from 'socket.io'
import Store from 'electron-store'
import { Notification } from 'electron'

import systeminformation from 'systeminformation'

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
        // Handle execute event
		socket.on(
            'execute',
            (executable: string, args: string, stdin: string, password: string) => {
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
				lockCommand = ['osascript', '-e', 'tell application "System Events" to keystroke "q" using {control down, command down}']
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
