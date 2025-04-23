const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: async () => {
        try {
            return await ipcRenderer.invoke('getSettings')
        } catch (err) {
            console.error('Failed to fetch settings:', err)
            return {}
        }
    },

    saveSettings: async (newSettings: any) => {
        try {
            return await ipcRenderer.invoke('saveSettings', newSettings)
        } catch (err) {
            console.error('Failed to save settings:', err)
            const errorMessage =
                err instanceof Error ? err.message : 'Unknown error'
            return { success: false, error: errorMessage }
        }
    },
})
