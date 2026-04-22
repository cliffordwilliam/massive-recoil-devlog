import { describe, it, expect, afterEach, afterAll } from 'bun:test'
import { SQL } from 'bun'

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

// Stack is assumed running via start.sh — connect to the exposed port
const db = new SQL(
	process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/massive_recoil',
)

const TEST_EMAIL = 'e2e_test_user@example.com'

afterEach(async () => {
	await db`DELETE FROM users WHERE email = ${TEST_EMAIL}`
})

afterAll(async () => {
	await db.close()
})

function post(body: unknown, contentType = 'application/json') {
	return fetch(`${BASE_URL}/api/users`, {
		method: 'POST',
		headers: { 'Content-Type': contentType },
		body: JSON.stringify(body),
	})
}

const valid_payload = {
	email: TEST_EMAIL,
	username: 'testuser',
	password: 'password123',
	password_confirmation: 'password123',
}

describe('POST /api/users', () => {
	it('returns 415 when Content-Type is not application/json', async () => {
		const res = await fetch(`${BASE_URL}/api/users`, {
			method: 'POST',
			headers: { 'Content-Type': 'text/plain' },
			body: 'hello',
		})
		expect(res.status).toBe(415)
		expect(await res.json()).toEqual({ error: 'Only application/json is accepted.' })
	})

	it('returns 422 when body is missing required fields', async () => {
		const res = await post({})
		expect(res.status).toBe(422)
		expect(await res.json()).toEqual({ errors: { body: ['is invalid'] } })
	})

	it('returns 422 with field errors for semantically invalid values', async () => {
		const res = await post({
			email: 'not-an-email',
			username: 'a',
			password: '123',
			password_confirmation: '456',
		})
		expect(res.status).toBe(422)
		const body = await res.json()
		expect(body.errors).toMatchObject({
			email: ['is invalid'],
			username: [expect.stringContaining('too short')],
			password: [expect.stringContaining('too short')],
		})
	})

	it('returns 422 when passwords do not match', async () => {
		const res = await post({
			...valid_payload,
			password_confirmation: 'different',
		})
		expect(res.status).toBe(422)
		const body = await res.json()
		expect(body.errors).toEqual({
			password_confirmation: ["doesn't match password"],
		})
	})

	it('returns 201 with user data and persists the row in the database', async () => {
		const res = await post(valid_payload)
		expect(res.status).toBe(201)

		const { user } = await res.json()
		expect(user.id).toBeTypeOf('number')
		expect(user.email).toBe(TEST_EMAIL)
		expect(user.username).toBe('testuser')
		expect(user).not.toHaveProperty('encrypted_password')
		expect(user).not.toHaveProperty('password')

		const [row] = await db`
			SELECT id, email, username, encrypted_password
			FROM users
			WHERE email = ${TEST_EMAIL}
		`
		expect(row).toBeDefined()
		expect(Number(row.id)).toBe(user.id)
		expect(row.email).toBe(TEST_EMAIL)
		expect(row.username).toBe('testuser')
		// password must be hashed, not stored in plain text
		expect(row.encrypted_password).not.toBe('password123')
		expect(row.encrypted_password).toMatch(/^\$2/)
	})

	it('returns 422 when email is already taken', async () => {
		await post(valid_payload)

		const res = await post({ ...valid_payload, username: 'anotheruser' })
		expect(res.status).toBe(422)
		const body = await res.json()
		expect(body.errors).toEqual({ email: ['has already been taken'] })
	})
})
