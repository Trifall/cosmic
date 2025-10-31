import type { DBUser } from '@/database/schema';
import { PERMISSIONS } from '@/src/lib/auth/roles-shared';
import { requirePermission } from '@/src/lib/server/auth';
import { createChildLogger } from '@/src/lib/server/logger';
import {
	deletePaste as deletePasteFunc,
	findPasteBySlug,
	getAllPastesWithPagination,
	transferPasteOwnership as transferPasteOwnershipFunc,
} from '@/src/lib/server/pastes';
import { error } from '@sveltejs/kit';
import * as z from 'zod';
import { command, getRequestEvent, query } from '$app/server';

const logger = createChildLogger('AdminPastesRemote');

/**
 * Query to fetch all pastes with pagination (admin oversight)
 */
export const getAdminPastes = query(
	z.object({
		page: z.number().min(1).default(1),
		limit: z.number().min(1).max(100).default(10),
		search: z.string().optional(),
	}),
	async ({ page, limit, search }) => {
		logger.debug(`getAdminPastes called with page: ${page}, limit: ${limit}, search: ${search}`);

		// get the full request event context on the server
		const event = getRequestEvent();
		if (!event) {
			throw error(500, 'Request context not available');
		}

		const { locals } = event;
		const user = (locals.user as DBUser | null) || null;
		const isAdmin = locals.isAdmin;

		// check authentication and admin access
		if (!user?.id || !isAdmin) {
			logger.warn('Unauthorized admin pastes access attempt');
			throw error(403, 'Admin access required');
		}

		try {
			// fetch all pastes with pagination (admin oversight)
			const pastesResult = await getAllPastesWithPagination(page, limit, search);

			logger.debug(
				`Retrieved ${pastesResult.pastes.length} pastes (page ${page}/${pastesResult.pagination.totalPages})`
			);

			return {
				pastes: pastesResult.pastes,
				pagination: pastesResult.pagination,
			};
		} catch (err) {
			logger.error(`Error fetching admin pastes: ${err}`);
			throw error(500, 'Failed to load pastes');
		}
	}
);

/**
 * Command to delete a paste (admin-only)
 */
export const deletePaste = command(z.object({ pasteId: z.string() }), async ({ pasteId }) => {
	logger.debug(`deletePaste command called for pasteId: ${pasteId}`);

	// get the full request event context on the server
	const event = getRequestEvent();
	if (!event) {
		throw error(500, 'Request context not available');
	}

	const { locals } = event;
	const user = (locals.user as DBUser | null) || null;

	// check permissions - admin can delete any paste
	await requirePermission(user, {
		pastes: [PERMISSIONS.pastes['delete:any']],
	});

	// get paste details to verify existence
	const paste = await findPasteBySlug(pasteId);
	if (!paste) {
		logger.warn(`Paste not found: ${pasteId}`);
		throw error(404, 'Paste not found');
	}

	// admin can delete any paste, no ownership check needed
	const result = await deletePasteFunc(pasteId);

	if (!result) {
		logger.error(`Failed to delete paste: ${pasteId}`);
		throw error(400, 'Failed to delete paste');
	}

	logger.info(`Paste deleted successfully: ${pasteId} by admin user: ${user?.id}`);

	// refresh the pastes list
	getAdminPastes({ page: 1, limit: 10 }).refresh();

	return { success: true, message: 'Paste deleted successfully' };
});

/**
 * Command to change paste ownership (admin-only)
 */
export const changeOwner = command(
	z.object({
		pasteId: z.string(),
		newOwnerId: z.string(),
		currentOwnerId: z.string(),
	}),
	async ({ pasteId, newOwnerId, currentOwnerId }) => {
		logger.debug(
			`changeOwner command called for pasteId: ${pasteId}, from: ${currentOwnerId}, to: ${newOwnerId}`
		);

		// get the full request event context on the server
		const event = getRequestEvent();
		if (!event) {
			throw error(500, 'Request context not available');
		}

		const { locals } = event;
		const user = (locals.user as DBUser | null) || null;

		// check permissions - admin can change ownership of any paste
		await requirePermission(user, {
			pastes: [PERMISSIONS.pastes['update:any']],
		});

		// verify paste exists
		const paste = await findPasteBySlug(pasteId);
		if (!paste) {
			logger.warn(`Paste not found: ${pasteId}`);
			throw error(404, 'Paste not found');
		}

		// transfer ownership
		const result = await transferPasteOwnershipFunc(pasteId, newOwnerId, currentOwnerId);

		if (!result.success) {
			logger.error(`Failed to transfer ownership: ${result.message}`);
			throw error(400, result.message || 'Failed to transfer ownership');
		}

		logger.info(
			`Paste ownership transferred: ${pasteId} from ${currentOwnerId} to ${newOwnerId} by admin user: ${user?.id}`
		);

		return {
			success: true,
			message: result.message || 'Ownership transferred successfully',
		};
	}
);
