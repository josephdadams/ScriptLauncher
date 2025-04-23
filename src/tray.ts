import { Tray, Menu, nativeImage, app } from 'electron'
import * as path from 'path'
import Store from 'electron-store'
import createSettingsWindow from './settings.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let tray: Tray | null = null
const store = new Store()

export default function createTray() {
    const image = nativeImage.createFromPath(
        path.join(__dirname, '../assets/tray-icon.png')
    )
    tray = new Tray(image.resize({ width: 16, height: 16 }))
    tray.setToolTip('ScriptLauncher')
    updateTrayMenu()
}

function updateTrayMenu() {
    const version = app.getVersion()
    const port = store.get('port')
    const isRunAtLogin = store.get('runAtLogin', false) as boolean

    const contextMenuTemplate: Electron.MenuItemConstructorOptions[] = [
        { label: `ScriptLauncher Version: ${version || ''}`, enabled: false },
        { label: `Listening on: ${port || ''}`, enabled: false },
        { type: 'separator' },
        {
            label: 'Run at Login',
            type: 'checkbox',
            checked: isRunAtLogin,
            click: (menuItem) => {
                const shouldEnable = menuItem.checked
                store.set('runAtLogin', shouldEnable)
                app.setLoginItemSettings({
                    openAtLogin: shouldEnable,
                    path: app.getPath('exe'),
                })
            },
        },
        {
            label: 'Settings',
            type: 'normal',
            click: () => {
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
    ]

    const contextMenu = Menu.buildFromTemplate(contextMenuTemplate)
    tray?.setContextMenu(contextMenu)
}

export { updateTrayMenu }
