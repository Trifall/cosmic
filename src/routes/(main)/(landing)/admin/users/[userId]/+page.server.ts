import type { DBUser } from '$database/schema';
import { createChildLogger } from '@/src/lib/server/logger';
import { error } from '@sveltejs/kit';
import {
	type IndividualUserStatistics,
	getIndividualUserStatistics,
	getUserDetailsById,
} from '$src/lib/server/users';
import type { PageServerLoad } from './$types';

const logger = createChildLogger('AdminUserSlugPage');

type LoadData = {
	user: DBUser;
	statistics: IndividualUserStatistics;
	error: string | null;
};

/**
 * Server-side load function for the admin user profile page
 * Fetches user details and comprehensive statistics
 */
export const load: PageServerLoad = async ({ parent, params }) => {
	const { user: currentUser } = await parent();
	const { userId } = params;

	if (!userId) {
		// request didnt have the query param
		throw error(400, 'A valid user ID is required');
	}

	const user = currentUser as DBUser;

	try {
		// fetch user details - function handles its own permission checking
		const userResult = await getUserDetailsById(user, userId);
		if (!userResult.ok) {
			logger.error(`Error fetching user details: ${userResult.error}`);
			throw error(404, 'User not found');
		}

		if (!userResult.value) {
			logger.error(`User not found`);
			throw error(404, 'User not found');
		}

		// fetch user statistics - function handles its own permission checking
		const statisticsResult = await getIndividualUserStatistics(user, userId);
		if (!statisticsResult.ok) {
			logger.error(`Error fetching user statistics: ${statisticsResult.error}`);
			return {
				user: userResult.value,
				statistics: {
					totalPastes: 0,
					publicPastes: 0,
					privatePastes: 0,
					authenticatedPastes: 0,
					inviteOnlyPastes: 0,
					totalViews: 0,
					totalUniqueViews: 0,
					averageViewsPerPaste: 0,
					mostViewedPaste: null,
					recentPastes: [],
					languageDistribution: [],
					accountAge: {
						days: 0,
						months: 0,
						years: 0,
					},
					lastActivity: null,
				} as IndividualUserStatistics,
				error: 'Failed to fetch user statistics',
			} as LoadData;
		}

		return {
			user: userResult.value,
			statistics: statisticsResult.value,
			error: null,
		} as LoadData;
	} catch (err) {
		logger.error(`Error in user profile page load function: ${err}`);
		throw error(500, 'An unexpected error occurred while loading user profile');
	}
};
