import { Tray, Menu, nativeImage, app } from 'electron'
import * as path from 'path'
import Store from 'electron-store'
import createSettingsWindow from './settings' // Import the createSettingsWindow function

let tray: Tray | null = null
const store = new Store()

export default function createTray() {
    // Create the tray icon using nativeImage and resize it to the desired size
    const image = nativeImage.createFromPath(
        path.join(__dirname, '../assets/tray-icon.png') // Adjust this path as needed
    )
    tray = new Tray(image.resize({ width: 16, height: 16 }))

    tray.setToolTip('ScriptLauncher') // Set the tooltip text
    updateTrayMenu()
}

// Function to update the tray menu based on the window state
function updateTrayMenu() {
    // Retrieve stored values
    const version = app.getVersion()
    const port = store.get('port')

    // Build context menu with version, IP, and Device ID
    let contextMenuTemplate = [
        { label: `ScriptLauncher Version: ${version || ''}`, enabled: false },
        { label: `Listening on: ${port || ''}`, enabled: false },
        { type: 'separator' },
        {
            label: 'Settings',
            type: 'normal',
            click: () => {
                // Open settings window
                createSettingsWindow()
            },
        },
        {
            label: 'Quit',
            type: 'normal',
            click: () => {
                app.quit()
            },
        },
    ] as Electron.MenuItemConstructorOptions[]

    const contextMenu = Menu.buildFromTemplate(contextMenuTemplate)

    tray?.setContextMenu(contextMenu)
}

export { updateTrayMenu }
