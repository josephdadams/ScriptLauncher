declare global {
    var mainWindow: BrowserWindow | null
}

import { app, BrowserWindow } from 'electron'
import createTray from './tray.js'
import { showNotification } from './notification'
import { initializeIpcHandlers } from './ipcHandlers.js'
import Store from 'electron-store'
import { initializeServer } from './api.js'

app.on('ready', () => {
    if (process.platform === 'darwin') {
        app.dock.hide()
    }

    const store = new Store()
    const PORT = store.get('port')
    const runAtLogin = store.get('runAtLogin', false) as boolean

    app.setLoginItemSettings({
        openAtLogin: runAtLogin,
        path: app.getPath('exe'),
    })

    createTray()
    initializeIpcHandlers()

    const server = initializeServer()
    server.listen(PORT, () => {
        console.log(`ScriptLauncher Server running on http://localhost:${PORT}`)
    })
})

app.on('window-all-closed', () => {
    // Do nothing so the app continues running in the tray
})

app.on('activate', () => {
    // Potential spot to show a notification or reopen a window
    // showNotification('ScriptLauncher is ready.')
})
