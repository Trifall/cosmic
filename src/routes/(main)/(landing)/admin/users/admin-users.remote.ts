import type { DBUser } from '@/database/schema';
import { PERMISSIONS } from '@/src/lib/auth/roles-shared';
import { requirePermission } from '@/src/lib/server/auth';
import { createChildLogger } from '@/src/lib/server/logger';
import { deleteUser as deleteUserFunc } from '@/src/lib/server/users';
import { error } from '@sveltejs/kit';
import * as z from 'zod';
import { command, getRequestEvent } from '$app/server';

const logger = createChildLogger('AdminUsersRemote');

/**
 * Command to delete a user (admin-only)
 */
export const deleteUser = command(z.object({ userId: z.string() }), async ({ userId }) => {
	logger.debug(`deleteUser command called for userId: ${userId}`);

	// get the full request event context on the server
	const event = getRequestEvent();
	if (!event) {
		throw error(500, 'Request context not available');
	}

	const { locals } = event;
	const user = (locals.user as DBUser | null) || null;

	// check permissions - admin can delete users
	await requirePermission(user, {
		user: [PERMISSIONS.user.delete],
	});

	if (!user) {
		throw error(401, 'Authentication required');
	}

	// delete the user
	const result = await deleteUserFunc(user, userId);

	if (!result.ok) {
		logger.error(`Failed to delete user: ${result.error.message}`);
		throw error(400, result.error.message);
	}

	logger.info(`User deleted successfully: ${userId} by admin user: ${user.id}`);

	// note: page data revalidation handled by client-side invalidateAll()

	return { success: true, message: 'User deleted successfully' };
});
