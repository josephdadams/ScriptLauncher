import { Notification } from 'electron'

/**
 * Shows a notification with the given title and body.
 * @param title - The title of the notification.
 * @param body - The body content of the notification.
 */
export function showNotification(title: string, body: string) {
    const notification = new Notification({
        title,
        body,
        silent: false, // Set to true if you want to suppress notification sounds
    })

    notification.show()
}
