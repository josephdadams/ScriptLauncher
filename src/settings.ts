import { BrowserWindow } from 'electron'
import * as path from 'path'

let settingsWindow: BrowserWindow | null = null

export default function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus()
        return
    }

    settingsWindow = new BrowserWindow({
        width: 400,
        height: 600,
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
