import { ipcMain } from 'electron'
import { store } from './store.js'

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
