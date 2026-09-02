// helpers/validate.ts
// Lightweight, dependency-free parameter validation for network-facing
// commands. Every assertion throws a CommandError(400) so the socket/REST
// layers surface a clean "bad request" instead of an opaque 500.
import { CommandError } from './errors.js'

export function assertString(value: unknown, name: string): string {
    if (typeof value !== 'string') {
        throw new CommandError(
            `Invalid or missing '${name}': expected a string`,
            400
        )
    }
    return value
}

export function assertNonEmptyString(value: unknown, name: string): string {
    const s = assertString(value, name)
    if (s.trim() === '') {
        throw new CommandError(`'${name}' must not be empty`, 400)
    }
    return s
}

export function assertOptionalString(
    value: unknown,
    name: string
): string | undefined {
    if (value === undefined || value === null) return undefined
    return assertString(value, name)
}

export function assertNonNegativeInteger(value: unknown, name: string): number {
    const n = typeof value === 'string' ? Number(value) : value
    if (
        typeof n !== 'number' ||
        !Number.isInteger(n) ||
        n < 0 ||
        !Number.isFinite(n)
    ) {
        throw new CommandError(
            `Invalid or missing '${name}': expected a non-negative integer`,
            400
        )
    }
    return n
}

export function assertOneOf<T extends string>(
    value: unknown,
    allowed: readonly T[],
    name: string
): T {
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
        throw new CommandError(
            `'${name}' must be one of: ${allowed.join(', ')}`,
            400
        )
    }
    return value as T
}

export function assertObject(
    value: unknown,
    name: string
): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new CommandError(
            `Invalid or missing '${name}': expected an object`,
            400
        )
    }
    return value as Record<string, unknown>
}

export function assertStringArray(value: unknown, name: string): string[] {
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        throw new CommandError(
            `Invalid '${name}': expected an array of strings`,
            400
        )
    }
    return value as string[]
}

// App/window names are interpolated into platform shell/script strings, so
// they must be restricted to a conservative, injection-safe character set.
const SAFE_APP_NAME = /^[A-Za-z0-9 ._-]+$/

export function assertAppName(value: unknown, name = 'appName'): string {
    const s = assertNonEmptyString(value, name)
    if (!SAFE_APP_NAME.test(s)) {
        throw new CommandError(`'${name}' contains unsupported characters`, 400)
    }
    return s
}
