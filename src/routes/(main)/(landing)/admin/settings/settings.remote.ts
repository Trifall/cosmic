import type { DBUser } from '$database/schema';
import { settings } from '@/database/schema';
import { error } from '@sveltejs/kit';
import { getRequestEvent, query } from '$app/server';
import { db } from '$lib/server/db';
import { createChildLogger } from '$lib/server/logger';
import { isUnauthenticatedUser } from '$src/lib/utils/format';

const logger = createChildLogger('SettingsRemote');

/**
 * Query to fetch all settings from the database
 * Admin-only access
 */
export const getAllSettingsQuery = query(async () => {
	logger.debug('getSettings called');

	// get the full request event context on the server
	const event = getRequestEvent();
	if (!event) {
		throw error(500, 'Request context not available');
	}

	const { locals } = event;
	const user = (locals.user as DBUser | null) || null;
	const isAdmin = locals.isAdmin;

	// check authentication and admin access
	if (isUnauthenticatedUser(user) || !isAdmin) {
		logger.warn('Unauthorized settings access attempt');
		throw error(403, 'Admin access required');
	}

	try {
		const settingsData = await db.select().from(settings);

		logger.debug(`Retrieved ${settingsData.length} settings`);

		return {
			settings: settingsData,
		};
	} catch (err) {
		logger.error(`Error fetching settings: ${err}`);
		throw error(500, 'Failed to load settings');
	}
});
