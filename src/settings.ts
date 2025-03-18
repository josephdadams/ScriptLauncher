import { BrowserWindow } from 'electron'
import * as path from 'path'

import { fileURLToPath } from 'url'

let settingsWindow: BrowserWindow | null = null

export default function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus()
        return
    }

    // Define __dirname in ESM
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    settingsWindow = new BrowserWindow({
        width: 400,
        height: 600,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, '../dist/preload.js'),
        },
    })

    settingsWindow.loadFile(path.join(__dirname, '../public/settings.html'))

    // Open the DevTools for debugging
    //settingsWindow.webContents.openDevTools()

    settingsWindow.on('closed', () => {
        settingsWindow = null
    })
}
