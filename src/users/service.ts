import { ValidationError } from '../errors'
import { create_user, find_user_by_email } from './repo'

export async function register_user(input: {
	email: string
	username: string
	password: string
	password_confirmation: string
}) {
	const email = input.email.toLowerCase().trim()
	const { username, password, password_confirmation } = input

	const errors: Record<string, string[]> = {}

	if (!email) {
		errors.email = ["can't be blank"]
	} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		errors.email = ['is invalid']
	}

	if (!username) {
		errors.username = ["can't be blank"]
	} else if (username.length < 2) {
		errors.username = ['is too short (minimum is 2 characters)']
	} else if (username.length > 100) {
		errors.username = ['is too long (maximum is 100 characters)']
	}

	if (!password) {
		errors.password = ["can't be blank"]
	} else if (password.length < 6) {
		errors.password = ['is too short (minimum is 6 characters)']
	} else if (password.length > 128) {
		errors.password = ['is too long (maximum is 128 characters)']
	}

	if (!password_confirmation) {
		errors.password_confirmation = ["can't be blank"]
	} else if (!errors.password && password_confirmation !== password) {
		errors.password_confirmation = ["doesn't match password"]
	}

	if (Object.keys(errors).length > 0) {
		throw new ValidationError(errors)
	}

	const existing = await find_user_by_email(email)
	if (existing) {
		throw new ValidationError({ email: ['has already been taken'] })
	}

	const encrypted_password = await Bun.password.hash(password, {
		algorithm: 'bcrypt',
		cost: 10,
	})

	return create_user({ email, username, encrypted_password })
}
