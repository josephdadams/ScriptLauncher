import { CommandError } from './errors.js'

import Store from 'electron-store'

const store = new Store()

export const EVENTS = {
    COMMAND_RESULT: 'command_result',

} as const

export function checkPassword(ctx: any, password?: string): boolean {

	const expected = store.get('password') || 'admin22'
	if (password !== expected) {
		throw new CommandError('Invalid password', 401)
	}
	return true
}