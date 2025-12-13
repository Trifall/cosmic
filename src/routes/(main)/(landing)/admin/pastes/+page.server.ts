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

export const actions = {
	deletePaste: async ({ request, locals }) => {
		const { user } = locals;

		// check permissions - admin only
		const isAdmin = locals.isAdmin;
		if (!user?.id || !isAdmin) {
			logger.warn('Unauthorized admin paste deletion attempt');
			throw error(403, 'Admin access required');
		}

		const formData = await request.formData();
		const pasteId = formData.get('pasteId')?.toString();

		if (!pasteId) {
			return { success: false, message: 'Paste ID is required' };
		}

		logger.debug(`Delete paste action called for pasteId: ${pasteId} by user: ${user.id}`);

		const { findPasteBySlug, deletePaste } = await import('$lib/server/pastes');

		try {
			// get paste details to verify existence
			const paste = await findPasteBySlug(pasteId);
			if (!paste) {
				return { success: false, message: 'Paste not found' };
			}

			// admin can delete any paste, no ownership check needed
			const result = await deletePaste(pasteId);

			if (!result) {
				return { success: false, message: 'Failed to delete paste' };
			}

			logger.info(`Paste deleted successfully: ${pasteId} by admin user: ${user.id}`);
			return { success: true };
		} catch (err) {
			logger.error(`Error deleting paste ${pasteId}: ${err}`);
			return { success: false, message: 'An unexpected error occurred' };
		}
	},

	changeOwner: async ({ request, locals }) => {
		const { user } = locals;

		// check permissions - admin only
		const isAdmin = locals.isAdmin;
		if (!user?.id || !isAdmin) {
			logger.warn('Unauthorized admin paste owner change attempt');
			throw error(403, 'Admin access required');
		}

		const formData = await request.formData();
		const pasteId = formData.get('pasteId')?.toString();
		const newOwnerId = formData.get('newOwnerId')?.toString();
		const currentOwnerId = formData.get('currentOwnerId')?.toString();

		if (!pasteId || !newOwnerId || !currentOwnerId) {
			return { success: false, message: 'Missing required fields' };
		}

		logger.debug(
			`Change owner action called for pasteId: ${pasteId}, from: ${currentOwnerId}, to: ${newOwnerId}`
		);

		const { findPasteBySlug, transferPasteOwnership } = await import('$lib/server/pastes');

		try {
			// verify paste exists
			const paste = await findPasteBySlug(pasteId);
			if (!paste) {
				return { success: false, message: 'Paste not found' };
			}

			// transfer ownership
			const result = await transferPasteOwnership(pasteId, newOwnerId, currentOwnerId);

			if (!result.success) {
				return { success: false, message: result.message || 'Failed to transfer ownership' };
			}

			logger.info(
				`Paste ownership transferred: ${pasteId} from ${currentOwnerId} to ${newOwnerId} by admin user: ${user.id}`
			);

			return { success: true, message: 'Ownership transferred successfully' };
		} catch (err) {
			logger.error(`Error changing owner for paste ${pasteId}: ${err}`);
			return { success: false, message: 'An unexpected error occurred' };
		}
	},
};
