import type { DBUser } from '@/database/schema';
import { user } from '@/database/schema/auth.schema';
import { pasteInvites } from '@/database/schema/pastes';
import { requirePermission } from '@/src/lib/server/auth';
import { db } from '@/src/lib/server/db';
import { createChildLogger } from '@/src/lib/server/logger';
import { secureSearchQuery, secureString } from '@/src/lib/shared/auth';
import { error } from '@sveltejs/kit';
import { and, eq, ilike, ne, notInArray } from 'drizzle-orm';
import * as z from 'zod';
import { getRequestEvent, query } from '$app/server';
import { PERMISSIONS } from '$src/lib/auth/roles-shared';

const logger = createChildLogger('UsersRemote');

/**
 * Search for users by username
 * Used for inviting users to pastes and changing paste ownership
 */
export const searchUsers = query(
	z.object({
		q: z.string().optional(),
		pasteId: z.string().optional(),
		includeSelf: z.boolean().optional().default(false),
	}),
	async ({ q, pasteId, includeSelf }) => {
		logger.debug(
			`searchUsers called with q: ${q}, pasteId: ${pasteId}, includeSelf: ${includeSelf}`
		);

		// get the full request event context on the server
		const event = getRequestEvent();
		if (!event) {
			throw error(500, 'Request context not available');
		}

		const { locals } = event;
		const dbUser = (locals.user as DBUser | null) || null;

		// check authentication
		if (!dbUser?.id) {
			logger.warn('Unauthenticated user search attempt');
			throw error(401, 'Authentication required');
		}

		// check permissions - must be able to create pastes to invite users
		try {
			await requirePermission(dbUser, {
				pastes: [PERMISSIONS.pastes.create],
			});
		} catch {
			throw error(403, 'Insufficient permissions');
		}

		// validate search query - prevent injection attacks
		if (q) {
			const validation = secureSearchQuery.safeParse(q);
			if (!validation.success) {
				throw error(400, 'Invalid search query - contains unsafe characters');
			}
		}

		// validate pasteId parameter for security
		if (pasteId) {
			const validation = secureString.safeParse(pasteId);
			if (!validation.success) {
				throw error(400, 'Invalid paste ID - contains unsafe characters');
			}
		}

		// get already invited user IDs if pasteId is provided
		let invitedUserIds: string[] = [];
		if (pasteId) {
			const invitedUsers = await db
				.select({ userId: pasteInvites.userId })
				.from(pasteInvites)
				.where(eq(pasteInvites.pasteId, pasteId));
			invitedUserIds = invitedUsers.map((u) => u.userId);
		}

		// if no query provided, return first 10 users (for initial dropdown)
		if (!q) {
			const conditions = [
				ne(user.banned, true), // exclude banned users
			];

			if (!includeSelf) {
				conditions.push(ne(user.id, dbUser.id));
			}

			// exclude already invited users if pasteId provided
			if (invitedUserIds.length > 0) {
				conditions.push(notInArray(user.id, invitedUserIds));
			}

			const users = await db
				.select({
					id: user.id,
					username: user.username,
					displayUsername: user.displayUsername,
					email: user.email,
					name: user.name,
					image: user.image,
				})
				.from(user)
				.where(and(...conditions))
				.limit(10);

			const formattedUsers = users.map((u) => ({
				id: u.id,
				username: u.username,
				displayUsername: u.displayUsername || u.username,
				email: u.email,
				name: u.name,
				image: u.image,
			}));

			// logger.debug(`Returning ${formattedUsers.length} initial users`);
			return { users: formattedUsers };
		}

		// minimum query length
		if (q.trim().length < 2) {
			return { users: [] };
		}

		const searchTerm = `%${q.trim()}%`;

		// build search conditions
		const searchConditions = [
			ne(user.banned, true), // exclude banned users
			ilike(user.username, searchTerm), // search in username
		];

		// exclude already invited users if pasteId provided
		if (invitedUserIds.length > 0) {
			searchConditions.push(notInArray(user.id, invitedUserIds));
		}

		if (!includeSelf) {
			searchConditions.push(ne(user.id, dbUser.id));
		}

		// search users by conditions
		const users = await db
			.select({
				id: user.id,
				username: user.username,
				displayUsername: user.displayUsername,
				email: user.email,
				name: user.name,
				image: user.image,
			})
			.from(user)
			.where(and(...searchConditions))
			.limit(10);

		const formattedUsers = users.map((u) => ({
			id: u.id,
			username: u.username,
			displayUsername: u.displayUsername || u.username,
			email: u.email,
			name: u.name,
			image: u.image,
		})) as Partial<DBUser>[];

		logger.debug(`Search returned ${formattedUsers.length} users for query: ${q}`);
		return { users: formattedUsers };
	}
);
