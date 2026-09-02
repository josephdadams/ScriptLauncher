// --- helpers/systemUtils.ts ---
import { spawn } from 'child_process'
import { Socket } from 'socket.io'
import systeminformation from 'systeminformation'
import { getFonts } from 'font-list'
import { EVENTS } from './events.js'

export async function getSystemInfo() {
    try {
        const [
            cpu,
            cpuTemperature,
            currentLoad,
            fsSize,
            gpu,
            memory,
            networkInterfaces,
            networkStats,
        ] = await Promise.all([
            systeminformation.cpu(),
            systeminformation.cpuTemperature(),
            systeminformation.currentLoad(),
            systeminformation.fsSize(),
            systeminformation.graphics(),
            systeminformation.mem(),
            systeminformation.networkInterfaces(),
            systeminformation.networkStats(),
        ])
        return {
            cpu,
            cpuTemperature,
            currentLoad,
            fsSize,
            gpu,
            memory,
            networkInterfaces,
            networkStats,
        }
    } catch (error) {
        console.error('Error getting system information:', error)
        return null
    }
}

export function runScript(
    executable: string,
    args: string[] = [],
    stdin?: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        console.log(`Running script: ${executable} ${args.join(' ')}`)

        const process = spawn(executable, args)

        let output = '',
            errorOutput = ''

        if (typeof stdin === 'string') {
            process.stdin.write(stdin)
        }
        process.stdin.end()

        process.stdout.on('data', (data) => (output += data.toString()))
        process.stderr.on('data', (data) => (errorOutput += data.toString()))

        process.on('close', (code) => {
            code === 0
                ? resolve(output)
                : reject(`Error executing script: ${errorOutput}`)
        })

        process.on('error', (err) =>
            reject(`Failed to start process: ${err.message}`)
        )
    })
}

export async function getInstalledFontFamilies(): Promise<string[]> {
    try {
        const fonts = await getFonts()
        return [
            ...new Set(
                fonts.map((f) => f.trim().replace(/^"|"$/g, '')) // ← cleans up extra quotes
            ),
        ].sort()
    } catch (error) {
        console.error('Error listing fonts:', error)
        return []
    }
}

export function runSystemCommand(
    command: string[],
    successMessage: string,
    socket?: Socket
) {
    const proc = spawn(command[0], command.slice(1))

    proc.on('close', (code) => {
        if (socket) {
            socket.emit(
                EVENTS.COMMAND_RESULT,
                code === 0 ? successMessage : 'Error executing command.'
            )
        }
    })

    proc.on('error', (err) => {
        if (socket) {
            socket.emit(
                EVENTS.COMMAND_RESULT,
                `Error during execution: ${err.message}`
            )
        }
    })
}

export function shutdownSystem(minutes: number, socket?: Socket) {
    const platform = process.platform
    const msg = `The system will shut down in ${minutes} minutes.`
    // On Linux `shutdown` is systemd's, which authorizes an active local
    // session through polkit. sudo would need a TTY it never gets from spawn.
    const shutdownCmd =
        platform === 'win32'
            ? ['shutdown', '/s', '/f', '/t', (minutes * 60).toString()]
            : platform === 'darwin'
              ? ['sudo', 'shutdown', '-h', `+${minutes}`, msg]
              : ['shutdown', '-h', `+${minutes}`, msg]

    if (platform !== 'win32') {
        const notifyCmd =
            platform === 'darwin'
                ? [
                      'osascript',
                      '-e',
                      `display notification "${msg}" with title "Shutdown Alert"`,
                  ]
                : // From libnotify; absent on minimal installs, in which
                  // case runSystemCommand reports the spawn error.
                  ['notify-send', 'Shutdown Alert', msg]
        runSystemCommand(notifyCmd, msg, socket)
    }

    runSystemCommand(shutdownCmd, msg, socket)
}
