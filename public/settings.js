// Load current settings into the form
window.electronAPI.getSettings().then((settings) => {
    document.getElementById('password').value = settings.password || 'admin'
})

const feedback = document.getElementById('feedback')
const form = document.getElementById('settingsForm')

form.addEventListener('submit', async (event) => {
    event.preventDefault()

    const password = document.getElementById('password').value

    if (!password || password.length < 3) {
        feedback.textContent = 'Password must be at least 3 characters.'
        feedback.style.color = 'red'
        return
    }

    const newSettings = { password }
    const result = await window.electronAPI.saveSettings(newSettings)

    if (result.success) {
        feedback.textContent = 'Settings saved successfully.'
        feedback.style.color = 'green'
        //close out the window after 2 seconds
        setTimeout(() => {
            window.close()
        }, 2000)
    } else {
        feedback.textContent = 'Error saving settings: ' + result.error
        feedback.style.color = 'red'
    }
})
