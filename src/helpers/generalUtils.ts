import { CommandError } from './errors.js'
import { store } from '../store.js'
import { passwordsMatch } from './password.js'

// Re-exported so existing imports keep working, while the constants/helpers
// themselves live in dependency-free modules.
export { EVENTS } from './events.js'
export { passwordsMatch } from './password.js'

// Throws CommandError(401) on failure; returns true otherwise so callers can
// simply `checkPassword(ctx, password)` for its side effect.
export function checkPassword(_ctx: unknown, password?: string): boolean {
    const expected = store.get('password') || 'admin'
    if (!passwordsMatch(password ?? '', String(expected))) {
        throw new CommandError('Invalid password', 401)
    }
    return true
}
