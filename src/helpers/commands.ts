// helpers/commands.ts
import { Notification } from 'electron'
import fs from 'fs'
import path from 'path'

import {
    runScript,
    runSystemCommand,
    shutdownSystem,
    getSystemInfo,
    getInstalledFontFamilies,
} from './systemUtils.js'
import {
    moveDatedFile,
    moveFile,
    moveFiles,
    getFileSizeInMB,
    getLatestFile,
} from './fileUtils.js'
import { sendInputCommand } from './inputHandlers.js'
import { checkPassword, EVENTS } from './generalUtils.js'
import { Socket } from 'socket.io'

export type CommandContext =
    | {
          emit?: (event: string, data: any) => void
          platform?: NodeJS.Platform
      }
    | Socket

export type CommandHandler = (
    params?: any,
    password?: string,
    ctx?: CommandContext
) => Promise<any>

function withMeta<T extends CommandHandler>(
    fn: T,
    meta: {
        description?: string
        paramsExample?: Record<string, any>
        requiresPassword?: boolean
        usesEmit?: boolean
    }
): T {
    Object.assign(fn, { _meta: meta })
    return fn
}

// ---- SYSTEM COMMANDS ----
const systemCommands = {
    shutdown: withMeta(
        async ({ time = 1 }, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            shutdownSystem(time)
            return `System will shut down in ${time} minutes.`
        },
        {
            description: 'Shutdown the system after a delay (in minutes)',
            paramsExample: { time: 5 },
            requiresPassword: true,
            usesEmit: true,
        }
    ),

    reboot: withMeta(
        async (_, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            const cmd =
                process.platform === 'win32'
                    ? ['shutdown', '/r', '/f', '/t', '0']
                    : ['sudo', 'reboot']
            await runSystemCommand(cmd, 'System is rebooting...')
            return `System will reboot now.`
        },
        {
            description: 'Reboot the system immediately',
            paramsExample: {},
            requiresPassword: true,
            usesEmit: true,
        }
    ),

    lock: withMeta(
        async (_, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            const cmd =
                process.platform === 'win32'
                    ? ['rundll32.exe', 'user32.dll,LockWorkStation']
                    : process.platform === 'darwin'
                      ? [
                            'osascript',
                            '-e',
                            'tell application "System Events" to keystroke "q" using {control down, command down}',
                        ]
                      : ['gnome-screensaver-command', '-l']
            await runSystemCommand(cmd, 'System locking...')
            return 'System locked.'
        },
        {
            description: 'Lock the user session',
            paramsExample: {},
            requiresPassword: true,
        }
    ),

    shutdown_cancel: withMeta(
        async (_, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            const cmd =
                process.platform === 'win32'
                    ? ['shutdown', '/a']
                    : ['sudo', 'shutdown', '-c']
            await runSystemCommand(cmd, 'Shutdown cancelled.')
            return `Shutdown cancelled.`
        },
        {
            description: 'Cancel a pending shutdown',
            paramsExample: {},
            requiresPassword: true,
            usesEmit: true,
        }
    ),

    getSystemInfo: withMeta(
        async () => {
            return await getSystemInfo()
        },
        {
            description: 'Return system information snapshot',
            requiresPassword: false,
        }
    ),
}

// ---- SCRIPT COMMANDS ----
const scriptCommands = {
    runScript: withMeta(
        async (params, password, ctx) => {
            console.log('Running script with params:', params)
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            const { executable, args, stdin } = params
            return await runScript(executable, args, stdin)
        },
        {
            description:
                'Execute a local script with arguments and optional stdin',
            paramsExample: {
                executable: '/path/to/script.sh',
                args: ['--flag'],
                stdin: 'input',
            },
            requiresPassword: true,
        }
    ),
}

// ---- INPUT COMMANDS ----
const inputCommands = {
    sendInput: withMeta(
        async (params, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            sendInputCommand(params)
            return `Input command executed: ${params.type}`
        },
        {
            description: 'Send keyboard or mouse input',
            paramsExample: { type: 'key', key: 'A' },
            requiresPassword: true,
        }
    ),
}

// ---- UI COMMANDS ----
const uiCommands = {
    sendAlert: withMeta(
        async ({ message }, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            new Notification({
                title: 'ScriptLauncher Alert',
                body: message || 'Alert',
            }).show()
            return `Alert sent: ${message}`
        },
        {
            description: 'Display a desktop alert notification',
            paramsExample: { message: 'Hello world' },
            requiresPassword: true,
        }
    ),

    getFonts: withMeta(
        async () => {
            return await getInstalledFontFamilies()
        },
        {
            description: 'Return a list of installed system fonts',
            paramsExample: {},
            requiresPassword: false,
        }
    ),
}

// ---- FILE COMMANDS ----
const fileCommands = {
    moveFile: withMeta(
        async ({ sourcePath, destPath, copyOnly }, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')

            await moveFile(sourcePath, destPath, copyOnly, ctx as any)
            return `File moved successfully: ${destPath}`
        },
        {
            description: 'Move a file to a new location with a new name',
            paramsExample: {
                sourcePath: '/path/to/file.txt',
                destPath: '/new/path',
                copyOnly: false,
            },
            requiresPassword: true,
        }
    ),
    moveDatedFileInFolder: withMeta(
        async ({ src, order, dest, name, copyOnly }, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            await moveDatedFile({
                sourceFolderPath: src,
                destFolderPath: dest,
                newestOrOldest: order,
                fileName: name,
                copyOnly: copyOnly,
                socket: ctx as any,
            })
            return `File moved successfully: ${name}`
        },
        {
            description:
                'Move the newest/oldest file in a folder to a destination',
            paramsExample: {
                src: '/source',
                order: 'newest',
                dest: '/dest',
                name: 'file.txt',
                copyOnly: false,
            },
            requiresPassword: true,
        }
    ),

    moveDatedFileInFolderWithExtension: withMeta(
        async ({ src, order, ext, dest, name, copyOnly }, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            await moveDatedFile({
                sourceFolderPath: src,
                destFolderPath: dest,
                newestOrOldest: order,
                fileExtension: ext,
                fileName: name,
                copyOnly: copyOnly,
                socket: ctx as any,
            })
            return 'File moved by date and extension'
        },
        {
            description: 'Move the newest/oldest file with a given extension',
            paramsExample: {
                src: '/source',
                order: 'oldest',
                ext: '.log',
                dest: '/dest',
                name: 'log.txt',
            },
            requiresPassword: true,
        }
    ),

    moveFileBasedOnSize: withMeta(
        async (moveObj, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            const {
                sourceFolderPath,
                destFolderPathLarger,
                copyOnlyLarger,
                destFolderPathSmaller,
                copyOnlySmaller,
                sizeThreshold,
                fileExtension,
                newestOrOldest,
            } = moveObj
            const files = fs.readdirSync(sourceFolderPath)
            const fileSizes = files.map((file) => ({
                file,
                size: getFileSizeInMB(path.join(sourceFolderPath, file)),
            }))
            let larger = fileSizes
                .filter((f) => f.size >= sizeThreshold)
                .map((f) => f.file)
            let smaller = fileSizes
                .filter((f) => f.size < sizeThreshold)
                .map((f) => f.file)
            if (fileExtension) {
                const ext = fileExtension.toLowerCase()
                larger = larger.filter(
                    (f) => path.extname(f).toLowerCase() === ext
                )
                smaller = smaller.filter(
                    (f) => path.extname(f).toLowerCase() === ext
                )
            }
            if (newestOrOldest) {
                const largest = getLatestFile(
                    larger,
                    sourceFolderPath,
                    newestOrOldest
                )
                if (largest) larger = [largest]
                const smallest = getLatestFile(
                    smaller,
                    sourceFolderPath,
                    newestOrOldest
                )
                if (smallest) smaller = [smallest]
            }
            for (const file of larger) {
                await moveFile(
                    path.join(sourceFolderPath, file),
                    path.join(destFolderPathLarger, file),
                    copyOnlyLarger,
                    ctx as any
                )
            }
            for (const file of smaller) {
                await moveFile(
                    path.join(sourceFolderPath, file),
                    path.join(destFolderPathSmaller, file),
                    copyOnlySmaller,
                    ctx as any
                )
            }
            return 'Files moved based on size'
        },
        {
            description:
                'Move files based on whether they are larger or smaller than a size threshold',
            paramsExample: {
                sourceFolderPath: '/source',
                destFolderPathLarger: '/large',
                copyOnlyLarger: false,
                destFolderPathSmaller: '/small',
                copyOnlySmaller: true,
                sizeThreshold: 100,
                fileExtension: '.mp4',
                newestOrOldest: 'newest',
            },
            requiresPassword: true,
        }
    ),
}

// ---- APP COMMANDS ----
const appCommands = {
    focusApp: withMeta(
        async ({ appName }, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            const cmd =
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
            await runSystemCommand(cmd, `Focusing on ${appName}...`)
            return `Focused ${appName}`
        },
        {
            description: 'Bring a specific app window to the foreground',
            paramsExample: { appName: 'Safari' },
            requiresPassword: true,
        }
    ),

    quitApp: withMeta(
        async ({ appName }, password, ctx) => {
            if (!checkPassword(ctx as any, password))
                throw new Error('Invalid password')
            const cmd =
                process.platform === 'win32'
                    ? ['taskkill', '/F', '/IM', `${appName}.exe`]
                    : process.platform === 'darwin'
                      ? [
                            'osascript',
                            '-e',
                            `tell application "${appName}" to quit`,
                        ]
                      : ['pkill', '-f', appName]
            await runSystemCommand(cmd, `Quitting ${appName}...`)
            return `Quit ${appName}`
        },
        {
            description: 'Terminate the specified application',
            paramsExample: { appName: 'Slack' },
            requiresPassword: true,
        }
    ),
}

export const CommandHandlers: Record<string, CommandHandler> = {
    ...systemCommands,
    ...scriptCommands,
    ...inputCommands,
    ...uiCommands,
    ...fileCommands,
    ...appCommands,
}

export const CommandGroups = {
    system: systemCommands,
    script: scriptCommands,
    input: inputCommands,
    ui: uiCommands,
    file: fileCommands,
    app: appCommands,
}
