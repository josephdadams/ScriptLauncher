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
    getFileSizeInMB,
    getLatestFile,
    sanitizeUserPath,
    ensureDir,
} from './fileUtils.js'
import { sendInputCommand } from './inputHandlers.js'
import { checkPassword } from './generalUtils.js'
import {
    assertNonEmptyString,
    assertOptionalString,
    assertStringArray,
    assertObject,
    assertOneOf,
    assertAppName,
    assertNonNegativeInteger,
} from './validate.js'
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
            checkPassword(ctx as any, password)
            const minutes = assertNonNegativeInteger(time, 'time')
            shutdownSystem(minutes)
            return `System will shut down in ${minutes} minutes.`
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
            checkPassword(ctx as any, password)
            const cmd =
                process.platform === 'win32'
                    ? ['shutdown', '/r', '/f', '/t', '0']
                    : process.platform === 'darwin'
                      ? ['sudo', 'reboot']
                      : ['systemctl', 'reboot']
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
            checkPassword(ctx as any, password)
            const cmd =
                process.platform === 'win32'
                    ? ['rundll32.exe', 'user32.dll,LockWorkStation']
                    : process.platform === 'darwin'
                      ? [
                            'osascript',
                            '-e',
                            'tell application "System Events" to keystroke "q" using {control down, command down}',
                        ]
                      : [
                            'sh',
                            '-c',
                            'loginctl lock-session || xdg-screensaver lock || gnome-screensaver-command -l',
                        ]
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
            checkPassword(ctx as any, password)
            const cmd =
                process.platform === 'win32'
                    ? ['shutdown', '/a']
                    : process.platform === 'darwin'
                      ? ['sudo', 'shutdown', '-c']
                      : ['shutdown', '-c']
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
        async (_params, password, ctx) => {
            checkPassword(ctx as any, password)
            return await getSystemInfo()
        },
        {
            description: 'Return system information snapshot',
            requiresPassword: true,
        }
    ),
}

// ---- SCRIPT COMMANDS ----
const scriptCommands = {
    runScript: withMeta(
        async (params, password, ctx) => {
            console.log('Running script with params:', params)
            checkPassword(ctx as any, password)
            const { executable, args, stdin } = params ?? {}
            const exe = assertNonEmptyString(executable, 'executable')
            const scriptArgs =
                args === undefined ? [] : assertStringArray(args, 'args')
            const scriptStdin = assertOptionalString(stdin, 'stdin')
            return await runScript(exe, scriptArgs, scriptStdin)
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
            checkPassword(ctx as any, password)
            const input = assertObject(params, 'params')
            assertNonEmptyString(input.type, 'type')
            await sendInputCommand(input)
            return `Input command executed: ${input.type}`
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
            checkPassword(ctx as any, password)
            const text = assertOptionalString(message, 'message') || 'Alert'
            new Notification({
                title: 'ScriptLauncher Alert',
                body: text,
            }).show()
            return `Alert sent: ${text}`
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
            checkPassword(ctx as any, password)

            const src = assertNonEmptyString(sourcePath, 'sourcePath')
            const dest = assertNonEmptyString(destPath, 'destPath')
            await moveFile(src, dest, Boolean(copyOnly), ctx as any)
            return `File moved successfully: ${dest}`
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
        async (
            {
                sourceFolderPath,
                destFolderPath,
                newestOrOldest,
                fileExtension,
                fileName,
                copyOnly,
            },
            password,
            ctx
        ) => {
            checkPassword(ctx as any, password)

            await moveDatedFile({
                sourceFolderPath: assertNonEmptyString(
                    sourceFolderPath,
                    'sourceFolderPath'
                ),
                destFolderPath: assertOptionalString(
                    destFolderPath,
                    'destFolderPath'
                ) as string,
                newestOrOldest: assertOneOf(
                    newestOrOldest,
                    ['newest', 'oldest'] as const,
                    'newestOrOldest'
                ),
                fileExtension: assertOptionalString(
                    fileExtension,
                    'fileExtension'
                ),
                fileName: assertNonEmptyString(fileName, 'fileName'),
                copyOnly: Boolean(copyOnly),
                socket: ctx as any,
            })

            return `File moved successfully: ${fileName}`
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
            checkPassword(ctx as any, password)
            await moveDatedFile({
                sourceFolderPath: assertNonEmptyString(src, 'src'),
                destFolderPath: assertOptionalString(dest, 'dest') as string,
                newestOrOldest: assertOneOf(
                    order,
                    ['newest', 'oldest'] as const,
                    'order'
                ),
                fileExtension: assertOptionalString(ext, 'ext'),
                fileName: assertNonEmptyString(name, 'name'),
                copyOnly: Boolean(copyOnly),
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
            checkPassword(ctx as any, password)
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

            const source = sanitizeUserPath(
                assertNonEmptyString(sourceFolderPath, 'sourceFolderPath')
            )
            const destLarge = sanitizeUserPath(
                assertNonEmptyString(
                    destFolderPathLarger,
                    'destFolderPathLarger'
                )
            )
            const destSmall = sanitizeUserPath(
                assertNonEmptyString(
                    destFolderPathSmaller,
                    'destFolderPathSmaller'
                )
            )
            if (
                typeof sizeThreshold !== 'number' ||
                Number.isNaN(sizeThreshold)
            ) {
                throw new Error(
                    "Invalid or missing 'sizeThreshold': expected a number"
                )
            }

            if (!fs.existsSync(source)) {
                throw new Error(`Source folder does not exist: ${source}`)
            }

            const files = fs.readdirSync(source).filter((f) => {
                try {
                    return fs.statSync(path.join(source, f)).isFile()
                } catch {
                    return false
                }
            })

            const fileSizes = files.map((file) => ({
                file,
                size: getFileSizeInMB(path.join(source, file)),
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
                const target = path.join(destLarge, file)
                ensureDir(path.dirname(target))
                await moveFile(
                    path.join(source, file),
                    target,
                    copyOnlyLarger,
                    ctx as any
                )
            }
            for (const file of smaller) {
                const target = path.join(destSmall, file)
                ensureDir(path.dirname(target))
                await moveFile(
                    path.join(source, file),
                    target,
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
            checkPassword(ctx as any, password)
            const app = assertAppName(appName)
            const cmd =
                process.platform === 'win32'
                    ? [
                          'powershell',
                          '-command',
                          `& { $p=Get-Process -Name '${app}' -ErrorAction SilentlyContinue; if ($p) { $h=$p.MainWindowHandle; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinAPI { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }'; [WinAPI]::SetForegroundWindow($h) } else { Start-Process '${app}' } }`,
                      ]
                    : process.platform === 'darwin'
                      ? [
                            'osascript',
                            '-e',
                            `tell application "${app}" to activate`,
                        ]
                      : [
                            'sh',
                            '-c',
                            `wmctrl -a "${app}" || xdotool search --name "${app}" windowactivate || "${app}" &`,
                        ]
            await runSystemCommand(cmd, `Focusing on ${app}...`)
            return `Focused ${app}`
        },
        {
            description: 'Bring a specific app window to the foreground',
            paramsExample: { appName: 'Safari' },
            requiresPassword: true,
        }
    ),

    quitApp: withMeta(
        async ({ appName }, password, ctx) => {
            checkPassword(ctx as any, password)
            const app = assertAppName(appName)
            const cmd =
                process.platform === 'win32'
                    ? ['taskkill', '/F', '/IM', `${app}.exe`]
                    : process.platform === 'darwin'
                      ? ['osascript', '-e', `tell application "${app}" to quit`]
                      : ['pkill', '-x', app]
            await runSystemCommand(cmd, `Quitting ${app}...`)
            return `Quit ${app}`
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
