import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { ROUTES } from '$src/lib/routes';
import { getSetting } from '$src/lib/server/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session) {
		redirect(302, ROUTES.DASHBOARD);
	}

	// check if public registration is enabled (with environment override)
	const registrationEnabled = await getSetting('publicRegistration');

	return {
		isPublicRegistrationEnabled: registrationEnabled,
		redirectPath: ROUTES.DASHBOARD,
	};
};
