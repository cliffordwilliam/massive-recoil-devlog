export class AppError extends Error {
	constructor(
		message: string,
		readonly status_code: number,
	) {
		super(message)
		this.name = this.constructor.name
	}
}

export class ValidationError extends AppError {
	constructor(readonly errors: Record<string, string[]>) {
		super('Unprocessable entity', 422)
	}
}

export class UnsupportedMediaTypeError extends AppError {
	constructor() {
		super('Only application/json is accepted.', 415)
	}
}
