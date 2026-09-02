// helpers/autoLaunch.ts
// app.setLoginItemSettings is macOS/Windows only, so on Linux the tray's
// "Run at Login" checkbox silently did nothing. Linux uses an XDG autostart
// desktop entry instead; the other platforms keep their existing behavior.
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const DESKTOP_FILE = 'scriptlauncher.desktop'

function autostartDir(): string {
    const configHome =
        process.env.XDG_CONFIG_HOME || path.join(app.getPath('home'), '.config')
    return path.join(configHome, 'autostart')
}

// Inside an AppImage, getPath('exe') points at a temporary mount that will not
// exist on the next boot. APPIMAGE holds the path of the .AppImage itself.
function launchTarget(): string {
    return process.env.APPIMAGE || app.getPath('exe')
}

function desktopEntry(): string {
    const exec = launchTarget().replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return [
        '[Desktop Entry]',
        'Type=Application',
        'Version=1.0',
        'Name=ScriptLauncher',
        'Comment=Runs scripts on request via Socket.IO and REST',
        `Exec="${exec}"`,
        'Icon=scriptlauncher',
        'Terminal=false',
        'X-GNOME-Autostart-enabled=true',
        '',
    ].join('\n')
}

export function setAutoLaunch(enabled: boolean): void {
    if (process.platform !== 'linux') {
        app.setLoginItemSettings({
            openAtLogin: enabled,
            path: app.getPath('exe'),
        })
        return
    }

    const target = path.join(autostartDir(), DESKTOP_FILE)

    try {
        if (enabled) {
            fs.mkdirSync(autostartDir(), { recursive: true })
            fs.writeFileSync(target, desktopEntry(), { mode: 0o644 })
        } else {
            fs.rmSync(target, { force: true })
        }
    } catch (error) {
        // Not worth failing startup over -- the setting just will not stick.
        console.error('Failed to update autostart entry:', error)
    }
}
