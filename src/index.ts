import './env'
import { Elysia } from 'elysia'
import { UnsupportedMediaTypeError } from './errors'
import { error_handler } from './plugins/error_handler'
import { logger } from './plugins/logger'
import { users_router } from './users/router'

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH'])

const app = new Elysia({
	cookie: {
		secrets: process.env.SESSION_SECRET!,
		sign: ['session'],
	},
})
	.use(logger)
	.use(error_handler)
	.onRequest(({ request }) => {
		if (!METHODS_WITH_BODY.has(request.method)) return
		if (!request.headers.get('content-type')?.includes('application/json'))
			throw new UnsupportedMediaTypeError()
	})
	.use(users_router)
	.listen(3000)

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`)
