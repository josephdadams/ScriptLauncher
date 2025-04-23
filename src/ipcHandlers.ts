import { ipcMain } from 'electron'
import Store from 'electron-store'
import { defaultSettings } from './defaults.js'

const store = new Store({ defaults: defaultSettings })

export function initializeIpcHandlers() {
    ipcMain.handle('getSettings', () => {
        return store.store
    })

    ipcMain.handle('saveSettings', (_, newSettings: Record<string, any>) => {
        try {
            store.set(newSettings)
            return { success: true }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
        }
    })
}
