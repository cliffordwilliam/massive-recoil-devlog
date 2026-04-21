const REQUIRED = ['DATABASE_URL', 'SESSION_SECRET']

for (const key of REQUIRED) {
	if (!process.env[key]) {
		console.error(`[fatal] Missing required environment variable: ${key}`)
		process.exit(1)
	}
}
