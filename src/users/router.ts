import { Elysia } from 'elysia'
import { create_user_body, create_user_response } from './dto'
import { register_user } from './service'

export const users_router = new Elysia({ prefix: '/users' }).post(
	'/',
	async ({ body, cookie: { session }, status }) => {
		const user = await register_user(body)

		session.value = String(user.id)
		session.httpOnly = true
		session.sameSite = 'lax'
		session.secure = Bun.env.NODE_ENV === 'production'
		session.path = '/'

		return status(201, { user })
	},
	{ body: create_user_body, response: { 201: create_user_response } },
)
