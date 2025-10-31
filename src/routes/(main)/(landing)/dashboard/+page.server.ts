import type { DBUser } from '$database/schema';
import { createChildLogger } from '@/src/lib/server/logger';
import { error, fail, isActionFailure } from '@sveltejs/kit';
import { actionRequirePermission, requirePermission } from '$lib/server/auth';
import { deletePaste, findPasteBySlug, getUserPastesWithPagination } from '$lib/server/pastes';
import type { SinglePasteData } from '$lib/shared/pastes';
import type { PaginationData } from '$lib/utils/pagination';
import { PERMISSIONS, RoleNames } from '$src/lib/auth/roles-shared';
import { isDBUser } from '$src/lib/utils/format';
import type { Actions, PageServerLoad } from './$types';

const logger = createChildLogger('DashboardPage');

export const load: PageServerLoad = async ({ parent, url }) => {
	const { user, isAdmin } = await parent();

	// should be handled by layout, check anyway
	if (!user) {
		throw error(401, 'User not authenticated');
	}

	// get pagination parameters from URL
	const page = Number(url.searchParams.get('page') || '1');
	const limit = Number(url.searchParams.get('limit') || '10');
	const search = url.searchParams.get('search') || undefined;

	await requirePermission(user, { user: [PERMISSIONS.user['get:own']] });

	try {
		// fetch user's pastes with pagination
		const pastesResult = await getUserPastesWithPagination(user.id, page, limit, search);

		return {
			user,
			isAdmin,
			pastes: pastesResult.pastes as SinglePasteData[],
			pagination: pastesResult.pagination,
			search: search || '',
		};
	} catch (error) {
		logger.error(`Error fetching user pastes: ${error}`);

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
			pastes: [] as SinglePasteData[],
			pagination: fallbackPagination,
			search: search || '',
			error: 'Failed to load pastes',
		};
	}
};

export const actions: Actions = {
	deletePaste: async ({ request }) => {
		try {
			const res = await actionRequirePermission(request, {
				pastes: [PERMISSIONS.pastes['delete:own']],
			});

			if (!res || isActionFailure(res)) {
				return res;
			}

			const data = await request.formData();
			const pasteId = data.get('pasteId')?.toString();

			if (!pasteId) {
				return fail(400, {
					error: 'Paste ID is required',
				});
			}

			// get paste details to verify ownership
			const paste = await findPasteBySlug(pasteId);
			if (!paste) {
				return fail(404, {
					error: 'Paste not found',
				});
			}

			// check if user owns the paste or has admin permissions
			if (!isDBUser(res as DBUser)) {
				return fail(403, {
					error: 'You do not have permission to delete this paste',
				});
			}

			const hasDeleteAny = (res as DBUser).role === RoleNames.admin;
			const isOwner = paste.owner_id === (res as DBUser).id;

			if (!isOwner && !hasDeleteAny) {
				return fail(403, {
					error: 'You can only delete your own pastes',
				});
			}

			const result = await deletePaste(pasteId);

			if (!result) {
				return fail(400, {
					error: 'Failed to delete paste',
				});
			}

			return {
				success: true,
				message: 'Paste deleted successfully',
			};
		} catch (error) {
			logger.error(`Error in deletePaste action: ${error}`);
			return fail(500, {
				error: 'An error occurred while deleting the paste',
			});
		}
	},
};
