import { Socket } from 'socket.io'

import Store from 'electron-store'

export const EVENTS = {
    PLATFORM: 'platform',
    SYSTEM_INFO: 'system_info',
    COMMAND_RESULT: 'command_result',
    SHUTDOWN_RESULT: 'shutdown_result',
    SCRIPT_RESULT: 'script_result',
    FONT_LIST: 'fonts',
} as const

export function checkPassword(
    socket: Socket,
    password: string,
    event: string = 'command_result'
): boolean {
    const store = new Store()
    const adminPassword = store.get('password')
    if (password !== adminPassword) {
        socket.emit(event, 'Error: Invalid admin password.')
        return false
    }
    return true
}
