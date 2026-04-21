import { t } from 'elysia'

export const create_user_body = t.Object({
	email: t.String(),
	username: t.String(),
	password: t.String(),
	password_confirmation: t.String(),
})

export const create_user_response = t.Object({
	user: t.Object({
		id: t.Number(),
		email: t.String(),
		username: t.String(),
	}),
})
