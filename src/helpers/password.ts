// helpers/password.ts
// Pure, dependency-free password comparison so it can be unit-tested without
// the Electron runtime (electron-store).
import crypto from 'crypto'

// Constant-time string comparison to avoid leaking the password via timing.
export function passwordsMatch(provided: string, expected: string): boolean {
    const a = Buffer.from(String(provided ?? ''))
    const b = Buffer.from(String(expected ?? ''))
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
}
