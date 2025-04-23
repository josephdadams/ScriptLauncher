// utils/version.ts
import { app } from 'electron'

export function getAppVersion(): string {
    try {
        return app.getVersion()
    } catch {
        // fallback for dev/test environments
        return 'dev'
    }
}
