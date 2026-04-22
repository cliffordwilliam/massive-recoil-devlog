export class AppError extends Error {
	constructor(
		public message: string,
		public status_code: number,
	) {
		super(message)
	}
}

export class ValidationError extends AppError {
	constructor(public errors: Record<string, string[]> = { body: ['is invalid'] }) {
		super('Unprocessable entity', 422)
	}
}

export class UnsupportedMediaTypeError extends AppError {
	constructor() {
		super('Only application/json is accepted.', 415)
	}
}

export const errors = {
	APP_ERROR: AppError,
	VALIDATION_ERROR: ValidationError,
	UNSUPPORTED_MEDIA_TYPE_ERROR: UnsupportedMediaTypeError,
}
