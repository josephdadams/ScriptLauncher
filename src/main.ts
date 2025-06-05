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

    try {
        const server = initializeServer()
        server.listen(PORT, () => {
            console.log(`ScriptLauncher Server running on http://localhost:${PORT}`)
        })
    }
    catch(error) {
        showNotification('Error Starting ScriptLauncher', `Failed to start - is port ${PORT} in use elsewhere? Is ScriptLauncher already running?`)
    }
})

app.on('window-all-closed', () => {
    // Do nothing so the app continues running in the tray
})

app.on('activate', () => {
    // Potential spot to show a notification or reopen a window
    // showNotification('ScriptLauncher is ready.')
})

//prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
}
else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // This is where you can handle the second instance
        if (global.mainWindow) {
            if (global.mainWindow.isMinimized()) global.mainWindow.restore()
            global.mainWindow.focus()
        }
    })
}