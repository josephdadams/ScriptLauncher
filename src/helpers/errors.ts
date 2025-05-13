// helpers/errors.ts
export class CommandError extends Error {
	constructor(message: string, public statusCode: number = 400) {
		super(message)
		this.name = 'CommandError'
	}
}