import { Elysia } from 'elysia'

class Logger {
	info(msg: string) {
		console.log(`[info] ${msg}`)
	}

	error(msg: string, err?: unknown) {
		console.error(`[error] ${msg}`, err ?? '')
	}
}

export const logger = new Elysia({ name: 'logger' }).decorate(
	'logger',
	new Logger(),
)
