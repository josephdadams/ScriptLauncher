import { BrowserWindow } from 'electron'
import * as path from 'path'
import { fileURLToPath } from 'url'

let settingsWindow: BrowserWindow | null = null

export default function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus()
        return
    }

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    settingsWindow = new BrowserWindow({
        width: 300,
        height: 300,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    settingsWindow.loadFile(path.join(__dirname, '../public/settings.html'))

    settingsWindow.on('closed', () => {
        settingsWindow = null
    })
}
