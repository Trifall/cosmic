import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { ROUTES } from '$src/lib/routes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	const redirectPath = ROUTES.DASHBOARD;

	if (session) {
		redirect(302, redirectPath);
	}

	// also used on client signin page as callbackURL
	return {
		redirectPath,
	};
};
