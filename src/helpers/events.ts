// helpers/events.ts
// Event name constants, kept dependency-free so pure helpers can import them
// without pulling in electron-store (which requires the Electron runtime).
export const EVENTS = {
    COMMAND_RESULT: 'command_result',
} as const
