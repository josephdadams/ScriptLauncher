import { ipcMain } from 'electron'
import Store from 'electron-store'
import { defaultSettings } from './defaults.js' // Import default settings

const store = new Store({ defaults: defaultSettings })

// Initialize the IPC handlers
export function initializeIpcHandlers() {
    // Handle fetching settings
    ipcMain.handle('getSettings', () => {
        return store.store
    })

    // Handle saving settings
    ipcMain.handle('saveSettings', (_, newSettings) => {
        store.set(newSettings)
    })
}
