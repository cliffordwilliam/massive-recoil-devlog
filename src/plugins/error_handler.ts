import { AppError, ValidationError } from '../errors'

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

export function error_handler({ code, error, status, logger }) {
		if (error instanceof ValidationError) {
			return status(422, { errors: error.errors })
		}

		if (error instanceof AppError) {
			return status(error.status_code, { error: error.message })
		}

		if (code === 'VALIDATION') {
			return status(422, { errors: { body: ['is invalid'] } })
		}

		if (is_pg_error(error)) {
			if (error.code === '23505') {
				return status(422, { errors: { email: ['has already been taken'] } })
			}
			logger.error('Unexpected postgres error', error)
			return status(500, safe_500(error))
		}

		logger.error('Unhandled error', error)
		return status(500, safe_500(error))
	}
