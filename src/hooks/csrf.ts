import { env } from '$env/dynamic/public';
import type { Handle } from '@sveltejs/kit';
import { json, text } from '@sveltejs/kit';
import { createChildLogger } from '$lib/server/logger';

const logger = createChildLogger('CSRF');

// determine if request content-type indicates a form submission
function isFormContentType(request: Request): boolean {
	const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
	return ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'].includes(type);
}

// normalize origin by removing trailing slashes and converting to lowercase
function normalizeOrigin(origin: string): string {
	return origin.replace(/\/$/, '').toLowerCase();
}

/**
 * Custom CSRF Protection Middleware for reverse proxy environments
 *
 * This middleware handles CSRF protection at runtime, which is necessary when
 * running behind a reverse proxy (Cloudflare, Caddy, etc.) where the internal
 * request URL doesn't match the public origin.
 *
 * @param allowedPaths - List of URL paths that bypass CSRF protection (e.g., public APIs)
 * @param additionalOrigins - Additional trusted origins (besides PUBLIC_WEB_UI_URL)
 */
export function csrf(allowedPaths: string[] = [], additionalOrigins: string[] = []): Handle {
	return async ({ event, resolve }) => {
		const { request, url } = event;

		// only check state-changing methods
		const method = request.method;
		if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
			return resolve(event);
		}

		// skip paths that are explicitly allowed
		if (allowedPaths.includes(url.pathname)) {
			return resolve(event);
		}

		// get the origin header from the request
		const requestOrigin = request.headers.get('origin');

		// if no origin header, allow the request (same-origin or non-browser clients)
		if (!requestOrigin) {
			return resolve(event);
		}

		// build list of allowed origins from environment + additional origins
		const allowedOrigins: string[] = [];

		// add PUBLIC_WEB_UI_URL if configured (runtime environment variable)
		if (env.PUBLIC_WEB_UI_URL) {
			allowedOrigins.push(normalizeOrigin(env.PUBLIC_WEB_UI_URL));
		}

		// add any additional trusted origins
		for (const origin of additionalOrigins) {
			if (origin) {
				allowedOrigins.push(normalizeOrigin(origin));
			}
		}

		// check if same origin (comparing against the URL the server sees)
		const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
		const isSameOrigin = normalizedRequestOrigin === normalizeOrigin(url.origin);

		// check if request origin is in allowed origins list
		const isAllowedOrigin = allowedOrigins.includes(normalizedRequestOrigin);

		// determine if this is a potentially dangerous request
		const forbidden =
			isFormContentType(request) && // form submission
			!isSameOrigin && // origin mismatch
			!isAllowedOrigin; // not explicitly allowed

		if (forbidden) {
			const message = `Cross-site ${method} form submissions are forbidden`;
			logger.warn(
				`CSRF blocked: origin="${requestOrigin}" url="${url.origin}" allowed=[${allowedOrigins.join(', ')}]`
			);

			// return JSON or plain text based on request accept header
			if (request.headers.get('accept') === 'application/json') {
				return json({ message }, { status: 403 });
			}
			return text(message, { status: 403 });
		}

		return resolve(event);
	};
}
