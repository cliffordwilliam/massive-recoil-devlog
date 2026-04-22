import { UnsupportedMediaTypeError } from '../errors'

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH'])

export function enforce_json_content_type({ request }: { request: Request }) {
	if (!METHODS_WITH_BODY.has(request.method)) return
	if (!request.headers.get('content-type')?.includes('application/json'))
		throw new UnsupportedMediaTypeError()
}
