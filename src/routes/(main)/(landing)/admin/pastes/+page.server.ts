import { createChildLogger } from '@/src/lib/server/logger';
import { error, isRedirect, redirect } from '@sveltejs/kit';
import { getAllPastesWithPagination } from '$lib/server/pastes';
import type { PaginationData } from '$lib/utils/pagination';
import { isUnauthenticatedUser } from '$src/lib/utils/format';
import type { PageServerLoad } from './$types';

const logger = createChildLogger('AdminPastesPage');

export const load: PageServerLoad = async ({ parent, url }) => {
	const { user, isAdmin } = await parent();

	// should be handled by layout, check anyway
	if (isUnauthenticatedUser(user) || !isAdmin) {
		logger.error(`Admin access required`);
		throw error(403, 'Admin access required');
	}

	// get pagination parameters from URL
	const page = Number(url.searchParams.get('page') || '1');
	const limit = Number(url.searchParams.get('limit') || '10');
	const search = url.searchParams.get('search') || undefined;

	try {
		// fetch all pastes with pagination (admin oversight)
		const pastesResult = await getAllPastesWithPagination(page, limit, search);

		// redirect to last page if current page exceeds total pages
		if (pastesResult.pagination.totalPages > 0 && page > pastesResult.pagination.totalPages) {
			const newUrl = new URL(url);
			newUrl.searchParams.set('page', pastesResult.pagination.totalPages.toString());
			throw redirect(303, newUrl.pathname + newUrl.search);
		}

		return {
			user,
			isAdmin,
			pastes: pastesResult.pastes,
			pagination: pastesResult.pagination,
			search: search || '',
		};
	} catch (error) {
		if (isRedirect(error)) {
			throw error;
		}

		logger.error(`Error fetching all pastes: ${error}`);

		// return fallback data if paste fetching fails
		const fallbackPagination: PaginationData = {
			page: 1,
			limit: 10,
			total: 0,
			totalPages: 0,
		};

		return {
			user,
			isAdmin,
			pastes: [],
			pagination: fallbackPagination,
			search: search || '',
			error: 'Failed to load pastes',
		};
	}
};
