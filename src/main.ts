declare global {
    var mainWindow: BrowserWindow | null
}

import { app, BrowserWindow } from 'electron'
import createTray from './tray.js'
import { showNotification } from './notification'
import { initializeIpcHandlers } from './ipcHandlers.js' // Import IPC handlers if needed

import Store from 'electron-store'

import { initializeServer } from './api.js'

app.on('ready', () => {
    if (process.platform === 'darwin') {
        app.dock.hide()
    }

    const store = new Store()
    const PORT = store.get('port')

    createTray()

    // Initialize IPC handlers after window creation
    initializeIpcHandlers()

    // Initialize the server and start it
    const server = initializeServer()

    server.listen(PORT, () => {
        console.log(`ScriptLauncher Server running on http://localhost:${PORT}`)
    })
})

app.on('window-all-closed', () => {
    //don't do anything
})

app.on('activate', () => {
    //send a notification saying it's ready for scripts, or something
})
