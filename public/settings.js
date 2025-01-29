// Load current settings into the form
window.electronAPI.getSettings().then((settings) => {
    document.getElementById('password').value = settings.password || 'admin'
})

// Handle form submission and save the updated settings
document.getElementById('settingsForm').addEventListener('submit', (event) => {
    event.preventDefault()

    const newSettings = {
        password: document.getElementById('password').value,
    }

    // Save the new settings using Electron API
    window.electronAPI.saveSettings(newSettings).then(() => {
        // Close the settings window
        window.close()
    })
})
