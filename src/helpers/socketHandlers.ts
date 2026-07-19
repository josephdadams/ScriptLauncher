import { Socket, Server as SocketIOServer } from 'socket.io'
import { CommandHandlers } from './commands.js'
import { EVENTS } from './events.js'
import { checkPassword } from './generalUtils.js'
import { getSystemInfo } from './systemUtils.js'
import { CommandError } from './errors.js'

import os from 'os'
import { getAppVersion } from './version.js'
const APP_VERSION = getAppVersion()

let uptimeInterval: NodeJS.Timeout | undefined

export function registerSocketHandlers(io: SocketIOServer) {
    io.on('connection', (socket: Socket) => {
        // System-info polling is per-connection so clients don't clobber each
        // other's intervals, and it is torn down when the socket disconnects.
        let systemInfoInterval: NodeJS.Timeout | undefined
        const clearSystemInfo = () => {
            if (systemInfoInterval) {
                clearInterval(systemInfoInterval)
                systemInfoInterval = undefined
            }
        }

        let platformObj = {
            command: 'platform',
            status: 'ok',
            result: {
                version: APP_VERSION,
                platform: process.platform,
                arch: process.arch,
                hostname: os.hostname(),
            },
        }
        socket.emit(EVENTS.COMMAND_RESULT, platformObj)

        console.log(`[Socket] New connection: ${socket.id}`)

        // Unified socket command handler
        socket.on('command', async (data: any) => {
            const commandName = data?.command
            const password = data?.password
            const params = { ...data }

            delete params.command
            delete params.password

            if (
                !commandName ||
                typeof CommandHandlers[commandName] !== 'function'
            ) {
                let errorObj = {
                    command: commandName,
                    error: `Unknown command '${commandName}'`,
                }
                socket.emit(EVENTS.COMMAND_RESULT, errorObj)
                return
            }

            try {
                console.log(
                    `[Socket] Executing command: ${commandName}`,
                    params
                )

                const result = await CommandHandlers[commandName](
                    params,
                    password,
                    socket
                )

                socket.emit(EVENTS.COMMAND_RESULT, {
                    command: commandName,
                    status: 'ok',
                    result,
                })
            } catch (err: any) {
                if (err instanceof CommandError) {
                    socket.emit(EVENTS.COMMAND_RESULT, {
                        command: commandName,
                        error: err.message,
                    })
                } else {
                    console.error(
                        `[Socket] Unexpected error in '${commandName}':`,
                        err
                    )
                    socket.emit(EVENTS.COMMAND_RESULT, {
                        command: commandName,
                        error:
                            err.message ||
                            err.result ||
                            'Internal server error',
                    })
                }
            }
        })

        // Keep these as direct events if needed
        socket.on('startSystemInfo', (data: any) => {
            try {
                checkPassword(socket, data?.password)
            } catch (err: any) {
                socket.emit(EVENTS.COMMAND_RESULT, {
                    command: 'getSystemInfo',
                    error: err.message || 'Invalid password',
                })
                return
            }

            clearSystemInfo()
            systemInfoInterval = setInterval(async () => {
                const info = await getSystemInfo()
                const infoObj = {
                    command: 'getSystemInfo',
                    status: 'ok',
                    result: info,
                }
                socket.emit(EVENTS.COMMAND_RESULT, infoObj)
            }, 5000)
        })

        socket.on('stopSystemInfo', () => clearSystemInfo())
        socket.on('disconnect', () => clearSystemInfo())
    })

    //interval for uptime to all sockets
    if (!uptimeInterval) {
        uptimeInterval = setInterval(() => {
            const uptimeObj = {
                command: 'uptime',
                status: 'ok',
                result: {
                    uptime: process.uptime(),
                },
            }
            io.emit(EVENTS.COMMAND_RESULT, uptimeObj)
        }, 10000)
    }
}

export function stopSystemInfoInterval() {
    if (uptimeInterval) {
        clearInterval(uptimeInterval)
        uptimeInterval = undefined
        console.log(
            `[${new Date().toISOString()}] Server broadcast interval cleared`
        )
    }
}
