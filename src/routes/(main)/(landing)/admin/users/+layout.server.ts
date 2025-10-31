import { requirePermission } from '@/src/lib/server/auth';
import { createChildLogger } from '@/src/lib/server/logger';
import { error, redirect } from '@sveltejs/kit';
import { PERMISSIONS } from '$src/lib/auth/roles-shared';
import type { LayoutServerLoad } from './$types';

const logger = createChildLogger('AdminUsersLayout');

/**
 * Server-side load function for the admin/users layout
 * Checks if the user has permission to access the admin panel
 */
export const load: LayoutServerLoad = async ({ parent }) => {
	try {
		const { user } = await parent();

		if (!user) {
			redirect(
				302,
				`/error?error=${encodeURIComponent('You do not have permission to view this page')}`
			);
		}

		// check if user has valid permissions
		await requirePermission(user, {
			user: [PERMISSIONS.user.update],
		});

		// if we reach here, the user has permission
		return {
			user,
		};
	} catch (err: unknown) {
		// if the user doesn't have permission, throw a 403 error
		logger.error(`[Admin Users Route] Missing permission error: ${err}`);
		throw error(403, 'You do not have permission to access this section');
	}
};
