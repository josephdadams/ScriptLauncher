const { contextBridge, ipcRenderer } = require('electron')

// Expose APIs to the renderer process through contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
    // Wrapper for invoking IPC methods from the renderer
    invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),

    // Fetch settings from the main process
    getSettings: () => ipcRenderer.invoke('getSettings'),

    // Save settings to the main process
    saveSettings: (newSettings: any) =>
        ipcRenderer.invoke('saveSettings', newSettings),
})
