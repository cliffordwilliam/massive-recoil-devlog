import './env'
import { Elysia } from 'elysia'
import pino from 'pino'
import { error_handler } from './plugins/error_handler'
import { enforce_json_content_type } from './plugins/content_type_guard'
import { users_router } from './users/router'

const app = new Elysia({
	prefix: '/api',
	cookie: {
		secrets: process.env.SESSION_SECRET!,
		sign: ['session'],
	},
})
	.decorate('logger', pino())
	.onError(error_handler)
	.onRequest(enforce_json_content_type)
	.use(users_router)
	.listen(3000)

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`)
