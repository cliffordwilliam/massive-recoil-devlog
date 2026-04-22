
const is_prod = Bun.env.NODE_ENV === 'production'

function is_pg_error(err: unknown): err is { code: string } {
	return (
		typeof err === 'object' &&
		err !== null &&
		'code' in err &&
		typeof (err as Record<string, unknown>).code === 'string'
	)
}

function safe_500(error: unknown) {
	return {
		error: 'Internal server error.',
		...(is_prod ? {} : { detail: error instanceof Error ? error.message : String(error) }),
	}
}

export function error_handler({ code, error, set, logger }) {
	switch (code) {
		case 'VALIDATION_ERROR':
			set.status = 422
			return { errors: error.errors }

		case 'APP_ERROR':
			set.status = error.status_code
			return { error: error.message }

		case 'VALIDATION':
			set.status = 422
			return { errors: { body: ['is invalid'] } }

		case 'NOT_FOUND':
			set.status = 404
			return { error: 'Route not found' }

		case 'UNSUPPORTED_MEDIA_TYPE_ERROR':
			set.status = 415
			return { error: error.message }

		case 'INTERNAL_SERVER_ERROR':
			if (is_pg_error(error) && error.code === '23505') {
				set.status = 422
				const match = (error as any).detail?.match(/\((.*?)\)/)
				const field = match ? match[1] : 'field'
				return { errors: { [field]: [`${field} has already been taken`] } }
			}
			logger.error(error)
			set.status = 500
			return safe_500(error)

		default:
			logger.error(error)
			set.status = 500
			return safe_500(error)
	}
}
