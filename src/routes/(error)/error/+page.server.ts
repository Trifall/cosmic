import { createChildLogger } from '@/src/lib/server/logger';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { ROUTES } from '$src/lib/routes';
import type { PageServerLoad } from './$types';

const logger = createChildLogger('ErrorPage');

export const load: PageServerLoad = async ({ request, url }: { request: Request; url: URL }) => {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return;
	}

	if ('status' in session) {
		return;
	}

	// check if this is a ban-related error and user is no longer banned - if so, redirect to dashboard
	const isBanError =
		(url.searchParams.has('message') &&
			url.searchParams.get('message')?.toLowerCase().includes('banned')) ||
		url.searchParams.has('banned');

	if (isBanError && !session.user.banned) {
		logger.debug(`User ${session.user.id} is no longer banned, redirecting to dashboard`);
		throw redirect(302, ROUTES.DASHBOARD);
	}

	return {
		user: session.user,
		banned: session.user.banned,
		banReason: session.user.banReason,
	};
};
