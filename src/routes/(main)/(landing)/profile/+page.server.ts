import type { DBUser } from '$database/schema';
import { createChildLogger } from '@/src/lib/server/logger';
import { error } from '@sveltejs/kit';
import {
	type IndividualUserStatistics,
	getIndividualUserStatistics,
	getUserDetailsById,
} from '$src/lib/server/users';
import { isUnauthenticatedUser } from '$src/lib/utils/format';
import type { PageServerLoad } from './$types';

const logger = createChildLogger('ProfilePage');

type LoadData = {
	user: DBUser;
	statistics: IndividualUserStatistics;
	error: string | null;
};

/**
 * Server-side load function for the user profile page
 * Fetches current user's details and comprehensive statistics
 */
export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	// should be handled by layout, check anyway
	if (isUnauthenticatedUser(user)) {
		throw error(401, 'User not authenticated');
	}

	try {
		// fetch user details for current user
		const userResult = await getUserDetailsById(user, user.id);
		if (!userResult.ok) {
			logger.error(`Error fetching user details: ${userResult.error}`);
			throw error(404, 'User data not found');
		}

		if (!userResult.value) {
			logger.error(`User data not found`);
			throw error(404, 'User data not found');
		}

		// fetch user statistics for current user
		const statisticsResult = await getIndividualUserStatistics(user, user.id);
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
		throw error(500, 'An unexpected error occurred while loading your profile');
	}
};
