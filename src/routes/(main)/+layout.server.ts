import type { DBUser } from '$database/schema';
import { createChildLogger } from '@/src/lib/server/logger';
import { redirect } from '@sveltejs/kit';
import { auth, initializeDefaultUserData } from '$lib/server/auth';
import { RoleNames } from '$src/lib/auth/roles-shared';
import type { LayoutServerLoad } from './$types';

const logger = createChildLogger('MainLayout');

export const load: LayoutServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (session && 'status' in session) {
		return {
			user: null,
			isAdmin: false,
		};
	}

	if (session) {
		const user: DBUser = session.user;
		if (!user.role) {
			logger.info(`User role not found for user ${user.id}, initializing...`);
			await initializeDefaultUserData(user);
		}

		// check if user is banned
		if (user.banned) {
			throw redirect(302, `/error?banned=true`);
		}

		return {
			user,
			isAdmin: user.role === RoleNames.admin,
		};
	} else {
		return {
			user: null,
			isAdmin: false,
		};
	}
};
