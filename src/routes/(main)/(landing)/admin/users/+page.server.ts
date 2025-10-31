import type { DBUser } from '$database/schema';
import { createChildLogger } from '@/src/lib/server/logger';
import { isRedirect, redirect } from '@sveltejs/kit';
import { RoleNames } from '$src/lib/auth/roles-shared';
import { getAllUsersWithPagination } from '$src/lib/server/users';
import type { PaginationData } from '$src/lib/utils/pagination';
import type { PageServerLoad } from './$types';

const logger = createChildLogger('AdminUsersPage');

type LoadData = {
	users: DBUser[];
	pagination: PaginationData;
	search: string;
	bannedOnly: boolean;
	error: string | null;
};

/**
 * Server-side load function for the admin/users page
 * Fetches all users with their details and roles with their permissions
 */
export const load: PageServerLoad = async ({ parent, url }) => {
	const { user: currentUser } = await parent();

	// get pagination parameters from URL
	const page = Number(url.searchParams.get('page') || '1');
	const limit = Number(url.searchParams.get('limit') || '10');
	const search = url.searchParams.get('search') || undefined;
	const bannedOnly = url.searchParams.get('bannedOnly') === 'true';

	try {
		// get all users with pagination and search
		const usersResult = await getAllUsersWithPagination(
			currentUser,
			page,
			limit,
			search,
			bannedOnly
		);
		if (!usersResult.ok) {
			logger.error(`Error fetching users: ${usersResult.error}`);
			return {
				users: [],
				roles: [],
				pagination: {
					page,
					limit,
					total: 0,
					totalPages: 0,
				},
				search: search || '',
				bannedOnly,
				error: 'Failed to fetch users',
			} as LoadData;
		}

		// redirect to last page if current page exceeds total pages
		if (
			usersResult.value.pagination.totalPages > 0 &&
			page > usersResult.value.pagination.totalPages
		) {
			const newUrl = new URL(url);
			newUrl.searchParams.set('page', usersResult.value.pagination.totalPages.toString());
			throw redirect(303, newUrl.pathname + newUrl.search);
		}

		// get all roles with their permissions
		const rolesResult = RoleNames;
		if (!rolesResult) {
			logger.error(`Error fetching roles: ${rolesResult}`);
			return {
				users: usersResult.value.users,
				roles: [],
				pagination: usersResult.value.pagination,
				search: search || '',
				bannedOnly,
				error: 'Failed to fetch roles',
			} as LoadData;
		}

		return {
			users: usersResult.value.users,
			roles: rolesResult,
			pagination: usersResult.value.pagination,
			search: search || '',
			bannedOnly,
			error: null,
		};
	} catch (error) {
		if (isRedirect(error)) {
			throw error;
		}
		logger.error(`Error in users page load function: ${JSON.stringify(error)}`);
		return {
			users: [],
			pagination: {
				page,
				limit,
				total: 0,
				totalPages: 0,
			} as PaginationData,
			roles: [],
			search: search || '',
			bannedOnly,
			error: 'An unexpected error occurred',
		} as LoadData;
	}
};
