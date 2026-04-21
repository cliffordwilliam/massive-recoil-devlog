export async function find_user_by_email(email: string) {
	const [user] = await Bun.sql`
		SELECT id FROM users WHERE email = ${email} LIMIT 1
	`
	return user ?? null
}

export async function create_user(data: {
	email: string
	username: string
	encrypted_password: string
}) {
	const [user] = await Bun.sql`
		INSERT INTO users (email, encrypted_password, username)
		VALUES (${data.email}, ${data.encrypted_password}, ${data.username})
		RETURNING id, email, username
	`
	return user as { id: number; email: string; username: string }
}
