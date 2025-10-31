import { pasteInvites, pasteVersions, pasteViews, pastes } from '@/database/schema';
import { user } from '@/database/schema/auth.schema';
import { createChildLogger } from '@/src/lib/server/logger';
import { getSetting } from '@/src/lib/server/settings';
import type { InvitedUser, SinglePasteData, Visibility } from '@/src/lib/shared/pastes';
import { verifyPassword } from 'better-auth/crypto';
import type { User } from 'better-auth/types';
import { SQL, and, count, desc, eq, gt, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '$lib/server/db';
import type { PaginationData } from '$lib/utils/pagination';
import { dateEquals, emptyToNull, getChangedFields } from '$lib/utils/update-helpers';
import { PERMISSIONS, type Permission } from '$src/lib/auth/roles-shared';

const logger = createChildLogger('server/pastes');

/**
 * Generate a unique 8-character paste ID
 */
export const generatePasteId = (): string => {
	return nanoid(8);
};

/**
 * Validate password against paste's password hash
 */
export const validatePastePassword = async (
	pasteId: string,
	password: string
): Promise<boolean> => {
	try {
		const paste = await db
			.select({ passwordHash: pastes.passwordHash })
			.from(pastes)
			.where(eq(pastes.id, pasteId))
			.limit(1);

		// prevent timing attacks
		// use dummy hash if no password is set to maintain constant timing
		const hashToVerify =
			paste[0]?.passwordHash || '$2b$10$this.is.just.a.dummy.hash.for.timing.attack.type.stuff.yo';

		const isValid = await verifyPassword({ hash: hashToVerify, password });

		// only return true if both password exists AND verification passes
		return paste[0]?.passwordHash ? isValid : false;
	} catch (error) {
		logger.error(`Error validating paste password: ${error}`);
		return false;
	}
};

/**
 * Check if a custom slug is available
 */
export const isSlugAvailable = async (slug: string): Promise<boolean> => {
	const existing = await db
		.select({ id: pastes.id })
		.from(pastes)
		.where(or(eq(pastes.id, slug), eq(pastes.customSlug, slug)))
		.limit(1);

	return existing.length === 0;
};

/**
 * Get a user's current paste count
 */
export const getUserPasteCount = async (userId: string): Promise<number> => {
	const result = await db
		.select({ count: count() })
		.from(pastes)
		.where(eq(pastes.owner_id, userId));

	return result[0]?.count ?? 0;
};

/**
 * Check if user can view a paste based on visibility and permissions
 */
export const canUserViewPaste = async (
	paste: {
		id: string;
		owner_id: string | null;
		visibility: Visibility;
	},
	user: User | null,
	userPermissions: Permission[]
): Promise<boolean> => {
	// check based on visibility level
	switch (paste.visibility) {
		case 'PUBLIC':
			// anyone with read:public permission can view
			return userPermissions.includes(PERMISSIONS.pastes['read:public']);

		case 'AUTHENTICATED':
			// must be logged in and have read:authenticated permission
			return user !== null && userPermissions.includes(PERMISSIONS.pastes['read:authenticated']);

		case 'INVITE_ONLY':
			if (!user) return false;

			// owner can always view
			if (paste.owner_id === user.id) return true;

			// admin with read:any can view
			if (userPermissions.includes(PERMISSIONS.pastes['read:any'])) return true;

			// check if user has an invite
			const invite = await db
				.select({ id: pasteInvites.id })
				.from(pasteInvites)
				.where(and(eq(pasteInvites.pasteId, paste.id), eq(pasteInvites.userId, user.id)))
				.limit(1);

			return invite.length > 0;

		case 'PRIVATE':
			if (!user) return false;

			// only owner or admin with read:any can view
			return paste.owner_id === user.id || userPermissions.includes(PERMISSIONS.pastes['read:any']);

		default:
			return false;
	}
};

/**
 * Find a paste by ID or custom slug with owner username
 */
export const findPasteBySlug = async (slug: string) => {
	const paste = await db
		.select({
			id: pastes.id,
			customSlug: pastes.customSlug,
			content: pastes.content,
			owner_id: pastes.owner_id,
			visibility: pastes.visibility,
			language: pastes.language,
			title: pastes.title,
			passwordHash: pastes.passwordHash,
			expiresAt: pastes.expiresAt,
			currentVersion: pastes.currentVersion,
			views: pastes.views,
			uniqueViews: pastes.uniqueViews,
			createdAt: pastes.createdAt,
			updatedAt: pastes.updatedAt,
			lastViewedAt: pastes.lastViewedAt,
			burnAfterReading: pastes.burnAfterReading,
			versioningEnabled: pastes.versioningEnabled,
			versionHistoryVisible: pastes.versionHistoryVisible,
			ownerUsername: user.username,
		})
		.from(pastes)
		.leftJoin(user, eq(pastes.owner_id, user.id))
		.where(or(eq(pastes.id, slug), eq(pastes.customSlug, slug)))
		.limit(1);

	// check if paste has expired
	if (paste[0]?.expiresAt && paste[0].expiresAt < new Date()) {
		return null; // paste has expired
	}

	return paste[0] || null;
};

/**
 * Increment paste view count and record analytics
 */
export const incrementPasteViews = async (
	pasteId: string,
	viewerInfo: {
		ip?: string;
		userAgent?: string;
		userId?: string;
		referrer?: string;
	}
): Promise<void> => {
	await db.transaction(async (tx) => {
		const sanitizedIp = viewerInfo.ip?.substring(0, 45) || null;
		const sanitizedUserId = viewerInfo.userId || null;
		const sanitizedUserAgent = viewerInfo.userAgent?.substring(0, 500) || null; // prevent oversized strings
		const sanitizedReferrer = viewerInfo.referrer?.substring(0, 500) || null;

		// CTE query
		await tx.execute(sql`
			WITH paste_info AS (
				SELECT owner_id FROM pastes WHERE id = ${pasteId}::varchar
			),
			existing_view AS (
				SELECT 1 as found
				FROM paste_views
				WHERE paste_id = ${pasteId}::varchar
				AND (
					(${sanitizedUserId}::text IS NOT NULL AND user_id = ${sanitizedUserId}::text) OR
					(${sanitizedUserId}::text IS NULL AND user_id IS NULL AND viewer_ip = ${sanitizedIp}::varchar)
				)
				LIMIT 1
			)
			UPDATE pastes SET
				views = views + 1,
				unique_views = unique_views + CASE
					WHEN ${sanitizedUserId}::text IS NOT NULL AND (SELECT owner_id FROM paste_info) = ${sanitizedUserId}::text THEN 0  -- owner view: no unique increment
					WHEN EXISTS(SELECT 1 FROM existing_view) THEN 0                     -- repeat view: no unique increment
					ELSE 1                                                              -- new unique view: increment
				END,
				last_viewed_at = NOW()
			WHERE id = ${pasteId}::varchar
		`);

		await tx.insert(pasteViews).values({
			pasteId,
			viewerIp: sanitizedIp,
			userAgent: sanitizedUserAgent,
			userId: sanitizedUserId,
			referrer: sanitizedReferrer,
			viewedAt: new Date(),
		});
	});
};

/**
 * Create a new paste with version tracking
 */
export const createPaste = async (data: {
	id: string;
	content: string;
	owner_id: string | null;
	visibility: Visibility;
	customSlug?: string;
	language?: string;
	title?: string;
	passwordHash?: string;
	expiresAt?: Date;
	burnAfterReading?: boolean;
	invitedUserIds?: string[];
	versioningEnabled?: boolean;
	versionHistoryVisible?: boolean;
}) => {
	logger.info(`User ${data.owner_id ?? 'Guest'} creating paste ${data.id}`);
	return await db.transaction(async (tx) => {
		// insert the paste
		const newPaste = await tx
			.insert(pastes)
			.values({
				id: data.id,
				content: data.content,
				owner_id: data.owner_id,
				visibility: data.visibility,
				customSlug: data.customSlug,
				language: data.language || 'plaintext',
				title: data.title,
				passwordHash: data.passwordHash,
				expiresAt: data.expiresAt,
				burnAfterReading: data.burnAfterReading || false,
				currentVersion: 1,
				views: 0,
				uniqueViews: 0,
				versioningEnabled: data.versioningEnabled ?? false,
				versionHistoryVisible: data.versionHistoryVisible ?? false,
			})
			.returning();

		// handle invite-only paste invitations (only for authenticated users)
		if (data.visibility === 'INVITE_ONLY' && data.invitedUserIds?.length && data.owner_id) {
			const inviteRecords = data.invitedUserIds.map((userId) => ({
				pasteId: data.id,
				userId,
				invitedBy: data.owner_id!,
			}));

			await tx.insert(pasteInvites).values(inviteRecords);
		}

		return newPaste[0];
	});
};

/**
 * Update an existing paste with version tracking - only updates provided fields
 */
export const updatePaste = async (data: {
	id: string;
	content?: string;
	visibility?: Visibility;
	customSlug?: string;
	language?: string;
	title?: string;
	passwordHash?: string | null;
	expiresAt?: Date | null;
	burnAfterReading?: boolean;
	invitedUserIds?: string[];
	removedUserIds?: string[];
	updatedBy: string;
	changeDescription?: string;
	versioningEnabled?: boolean;
	versionHistoryVisible?: boolean;
}) => {
	return await db.transaction(async (tx) => {
		// get current paste data to compare changes
		const currentPasteResult = await tx
			.select({
				currentVersion: pastes.currentVersion,
				customSlug: pastes.customSlug,
				content: pastes.content,
				visibility: pastes.visibility,
				language: pastes.language,
				title: pastes.title,
				passwordHash: pastes.passwordHash,
				expiresAt: pastes.expiresAt,
				burnAfterReading: pastes.burnAfterReading,
				versioningEnabled: pastes.versioningEnabled,
				versionHistoryVisible: pastes.versionHistoryVisible,
			})
			.from(pastes)
			.where(eq(pastes.id, data.id))
			.limit(1);

		if (currentPasteResult.length === 0) {
			throw new Error('Paste not found');
		}

		const currentPaste = currentPasteResult[0];
		const contentChanged = data.content !== undefined && data.content !== currentPaste.content;

		// check if custom slug is available (excluding current paste)
		if (
			data.customSlug !== undefined &&
			data.customSlug !== null &&
			data.customSlug !== currentPaste.customSlug
		) {
			const existingSlug = await tx
				.select({ id: pastes.id })
				.from(pastes)
				.where(
					and(
						or(eq(pastes.id, data.customSlug), eq(pastes.customSlug, data.customSlug)),
						sql`${pastes.id} != ${data.id}`
					)
				)
				.limit(1);

			if (existingSlug.length > 0) {
				throw new Error('Custom slug already taken');
			}
		}

		// detect changed fields
		// if you add a new field to the data parameter, add it to the fieldsToCheck array
		const updateFields = getChangedFields(
			currentPaste,
			{
				content: data.content,
				visibility: data.visibility,
				customSlug: data.customSlug,
				language: data.language,
				title: data.title,
				passwordHash: data.passwordHash,
				expiresAt: data.expiresAt,
				burnAfterReading: data.burnAfterReading,
				versioningEnabled: data.versioningEnabled,
				versionHistoryVisible: data.versionHistoryVisible,
			},
			{
				// custom comparator for dates
				expiresAt: {
					equals: dateEquals,
				},
				// transform empty strings to null for optional fields
				customSlug: { transform: emptyToNull },
				title: { transform: emptyToNull },
				passwordHash: { transform: emptyToNull },
			},
			// explicitly list fields to check - TypeScript will catch if you forget one
			[
				'content',
				'visibility',
				'customSlug',
				'language',
				'title',
				'passwordHash',
				'expiresAt',
				'burnAfterReading',
				'versioningEnabled',
				'versionHistoryVisible',
			]
		);

		let hasChanges = Object.keys(updateFields).length > 0;

		// handle removed users first
		if (data.removedUserIds?.length) {
			logger.debug(`Removing user ids ${data.removedUserIds} from paste ${data.id}`);
			await tx
				.delete(pasteInvites)
				.where(
					and(eq(pasteInvites.pasteId, data.id), inArray(pasteInvites.userId, data.removedUserIds))
				);
			hasChanges = true;
		}

		// handle invite-only paste invitations
		const finalVisibility =
			data.visibility !== undefined ? data.visibility : currentPaste.visibility;

		if (finalVisibility === 'INVITE_ONLY') {
			// add new invitations if any
			if (data.invitedUserIds?.length) {
				// get existing invitations to avoid duplicates
				const existingInvites = await tx
					.select({ userId: pasteInvites.userId })
					.from(pasteInvites)
					.where(eq(pasteInvites.pasteId, data.id));

				const existingUserIds = existingInvites.map((invite) => invite.userId);

				// only invite users who aren't already invited
				const newUserIds = data.invitedUserIds.filter(
					(userId) => !existingUserIds.includes(userId)
				);

				if (newUserIds.length > 0) {
					const inviteRecords = newUserIds.map((userId) => ({
						pasteId: data.id,
						userId,
						invitedBy: data.updatedBy,
					}));

					await tx.insert(pasteInvites).values(inviteRecords);
					hasChanges = true;

					logger.debug(`Added new invitations for paste ${data.id}: ${newUserIds.join(', ')}`);
				}
			}
		} else if (data.visibility !== undefined && currentPaste.visibility === 'INVITE_ONLY') {
			logger.debug(`Removing all invitations for paste ${data.id}`);
			// remove all invitations if visibility changed from invite only
			await tx.delete(pasteInvites).where(eq(pasteInvites.pasteId, data.id));
			hasChanges = true;
		}

		// only update paste if there are actual changes
		let updatedPaste;
		if (hasChanges) {
			const finalUpdateFields: Record<string, unknown> = {
				...updateFields,
				updatedAt: new Date(),
			};

			// handle toggling off: wipe versions and reset counter
			if (data.versioningEnabled === false && currentPaste.versioningEnabled === true) {
				await tx.delete(pasteVersions).where(eq(pasteVersions.pasteId, data.id));
				finalUpdateFields.currentVersion = 1;
			}

			// decide if versioning is enabled after this update
			const willTrackVersion = (data.versioningEnabled ?? currentPaste.versioningEnabled) === true;

			if (contentChanged) {
				if (willTrackVersion) {
					// snapshot previous content at currentVersion
					await tx.insert(pasteVersions).values({
						pasteId: data.id,
						content: currentPaste.content!,
						versionNumber: currentPaste.currentVersion,
						createdBy: data.updatedBy,
						changeDescription: data.changeDescription || `Version ${currentPaste.currentVersion}`,
					});
					finalUpdateFields.currentVersion = currentPaste.currentVersion + 1;
				} else {
					// versioning disabled: keep at 1
					finalUpdateFields.currentVersion = 1;
				}
			}

			logger.debug(
				`Updating paste ${data.id} with fields: ${JSON.stringify(finalUpdateFields, null, 2)}`
			);

			updatedPaste = await tx
				.update(pastes)
				.set(finalUpdateFields)
				.where(eq(pastes.id, data.id))
				.returning();
		} else {
			// no changes, just return current paste
			updatedPaste = [currentPaste];
		}

		return updatedPaste[0];
	});
};

/** List version metadata for a paste */
export const listPasteVersionMeta = async (pasteId: string) => {
	const rows = await db
		.select({
			versionNumber: pasteVersions.versionNumber,
			createdAt: pasteVersions.createdAt,
			length: sql<number>`char_length(${pasteVersions.content})`.as('length'),
		})
		.from(pasteVersions)
		.where(eq(pasteVersions.pasteId, pasteId))
		.orderBy(desc(pasteVersions.versionNumber));

	return rows;
};

/** Get specific version content */
export const getPasteVersionContent = async (pasteId: string, versionNumber: number) => {
	const rows = await db
		.select({ content: pasteVersions.content })
		.from(pasteVersions)
		.where(and(eq(pasteVersions.pasteId, pasteId), eq(pasteVersions.versionNumber, versionNumber)))
		.limit(1);
	return rows[0]?.content ?? null;
};

/** Determine whether the user can view version history */
export const canViewVersionHistory = (
	paste: { owner_id: string | null; versioningEnabled: boolean; versionHistoryVisible: boolean },
	user: User | null,
	userPermissions: Permission[]
): boolean => {
	if (!paste.versioningEnabled) return false;
	// owner or admin (read:any) can view
	if (
		user &&
		(paste.owner_id === user.id || userPermissions.includes(PERMISSIONS.pastes['read:any']))
	) {
		return true;
	}
	return paste.versionHistoryVisible;
};

/**
 * Delete a paste by ID (hard delete from database)
 */
export const deletePaste = async (pasteId: string): Promise<boolean> => {
	try {
		// check if paste exists before deletion
		const existingPaste = await db
			.select({ id: pastes.id })
			.from(pastes)
			.where(eq(pastes.id, pasteId))
			.limit(1);

		if (existingPaste.length === 0) {
			return false; // paste doesn't exist
		}

		// delete the paste
		await db.delete(pastes).where(eq(pastes.id, pasteId));

		// verify deletion by checking if paste still exists
		const stillExists = await db
			.select({ id: pastes.id })
			.from(pastes)
			.where(eq(pastes.id, pasteId))
			.limit(1);

		return stillExists.length === 0;
	} catch (error) {
		logger.error(`Error deleting paste: ${error}`);
		return false;
	}
};

/**
 * Get invited users for a paste
 */
export const getPasteInvitedUsers = async (pasteId: string): Promise<InvitedUser[]> => {
	const invitedUsers = await db
		.select({
			id: user.id,
			username: user.username,
			displayUsername: user.displayUsername,
			invitedAt: pasteInvites.invitedAt,
		})
		.from(pasteInvites)
		.innerJoin(user, eq(pasteInvites.userId, user.id))
		.where(eq(pasteInvites.pasteId, pasteId))
		.orderBy(pasteInvites.invitedAt);

	return invitedUsers;
};

/**
 * Remove specific users from paste invitations
 */
export const removePasteInvites = async (pasteId: string, userIds: string[]) => {
	if (userIds.length === 0) return;

	await db
		.delete(pasteInvites)
		.where(and(eq(pasteInvites.pasteId, pasteId), inArray(pasteInvites.userId, userIds)));
};

/**
 * Get user's pastes with pagination and optional search
 */
export const getUserPastesWithPagination = async (
	userId: string,
	page: number = 1,
	limit: number = 10,
	search?: string
) => {
	const offset = (page - 1) * limit;

	const currentTime = new Date();
	const baseCondition = eq(pastes.owner_id, userId);

	const enableFullTextSearch = await getSetting('enableFullTextSearch');
	const searchResultLimit = await getSetting('searchResultsLimit');
	if (searchResultLimit && searchResultLimit > 0 && searchResultLimit < limit) {
		limit = searchResultLimit;
	}

	// user's pastes that are either not expired or have no expiration
	const expirationCondition = or(isNull(pastes.expiresAt), gt(pastes.expiresAt, currentTime));
	let whereCondition: SQL<unknown> | undefined = and(baseCondition, expirationCondition);
	// add search condition if database enabled
	if (enableFullTextSearch) {
		whereCondition = search
			? and(whereCondition, sql`${pastes.searchVector} @@ plainto_tsquery('english', ${search})`)
			: whereCondition;
	} else {
		whereCondition = search
			? and(
					whereCondition,
					or(
						ilike(pastes.title, `%${search}%`),
						ilike(pastes.language, `%${search}%`),
						ilike(pastes.customSlug, `%${search}%`)
					)
				)
			: whereCondition;
	}

	// get total count for pagination
	const [totalResult] = await db.select({ count: count() }).from(pastes).where(whereCondition);

	const total = totalResult.count;
	const totalPages = Math.ceil(total / limit);

	// get paginated results
	const userPastes = await db
		.select({
			id: pastes.id,
			customSlug: pastes.customSlug,
			title: pastes.title,
			language: pastes.language,
			visibility: pastes.visibility,
			views: pastes.views,
			createdAt: pastes.createdAt,
			updatedAt: pastes.updatedAt,
			expiresAt: pastes.expiresAt,
			owner_id: pastes.owner_id,
			ownerUsername: sql<string | null>`NULL`.as('ownerUsername'), // user's own pastes dont need username
			hasPassword: sql<boolean>`${pastes.passwordHash} IS NOT NULL`.as('hasPassword'),
		})
		.from(pastes)
		.where(whereCondition)
		.orderBy(desc(pastes.createdAt))
		.limit(limit)
		.offset(offset);

	const pagination: PaginationData = {
		page,
		limit,
		total,
		totalPages,
	};

	return {
		pastes: userPastes as SinglePasteData[],
		pagination,
	};
};

/**
 * Get all pastes with pagination and optional search (admin only)
 */
export const getAllPastesWithPagination = async (
	page: number = 1,
	limit: number = 10,
	search?: string
): Promise<{ pastes: SinglePasteData[]; pagination: PaginationData }> => {
	const offset = (page - 1) * limit;

	const enableFullTextSearch = await getSetting('enableFullTextSearch');
	const searchResultLimit = await getSetting('searchResultsLimit');
	if (searchResultLimit && searchResultLimit > 0 && searchResultLimit < limit) {
		limit = searchResultLimit;
	}

	const currentTime = new Date();

	// pastes that are either not expired or have no expiration
	let whereCondition: SQL<unknown> | undefined = or(
		isNull(pastes.expiresAt),
		gt(pastes.expiresAt, currentTime)
	);
	// add search condition if database enabled
	if (enableFullTextSearch) {
		whereCondition = search
			? and(whereCondition, sql`${pastes.searchVector} @@ plainto_tsquery('english', ${search})`)
			: whereCondition;
	} else {
		whereCondition = search
			? and(
					whereCondition,
					or(
						ilike(pastes.title, `%${search}%`),
						ilike(pastes.language, `%${search}%`),
						ilike(pastes.customSlug, `%${search}%`),
						ilike(user.username, `%${search}%`)
					)
				)
			: whereCondition;
	}

	// get total count for pagination
	const [totalResult] = await db
		.select({ count: count() })
		.from(pastes)
		.leftJoin(user, eq(pastes.owner_id, user.id))
		.where(whereCondition);

	const total = totalResult.count;
	const totalPages = Math.ceil(total / limit);

	// get paginated results with owner information
	const allPastes = await db
		.select({
			id: pastes.id,
			customSlug: pastes.customSlug,
			title: pastes.title,
			language: pastes.language,
			visibility: pastes.visibility,
			views: pastes.views,
			createdAt: pastes.createdAt,
			updatedAt: pastes.updatedAt,
			expiresAt: pastes.expiresAt,
			owner_id: pastes.owner_id,
			ownerUsername: user.username,
			hasPassword: sql<boolean>`${pastes.passwordHash} IS NOT NULL`.as('hasPassword'),
		})
		.from(pastes)
		.leftJoin(user, eq(pastes.owner_id, user.id))
		.where(whereCondition)
		.orderBy(desc(pastes.createdAt))
		.limit(limit)
		.offset(offset);

	const pagination: PaginationData = {
		page,
		limit,
		total,
		totalPages,
	};

	return {
		pastes: allPastes as SinglePasteData[],
		pagination,
	};
};

/**
 * Forked paste data type
 */
export type ForkedPasteData = {
	content: string;
	language: string;
	title: string;
	visibility: Visibility;
	customSlug: string;
	versioningEnabled: boolean;
	versionHistoryVisible: boolean;
	burnAfterReading: boolean;
	invitedUserIds: string[]; // user IDs for form submission
	invitedUsers: InvitedUser[]; // full user objects for UI display
	expiresAt: Date | null;
};

/**
 * Result type for fork paste data fetching
 */
export type ForkPasteResult =
	| { success: true; data: ForkedPasteData }
	| { success: false; error: string };

/**
 * Fetch and validate a paste for forking
 * Handles all permissions, visibility checks, and edge cases
 */
export const getForkPasteData = async (
	forkedFromId: string,
	user: User | null,
	isAdmin: boolean,
	versionParam?: string | null
): Promise<ForkPasteResult> => {
	try {
		// get user permissions based on authentication status
		let userPermissions: Permission[] = [];
		if (user !== null) {
			userPermissions = [
				PERMISSIONS.pastes['read:public'],
				PERMISSIONS.pastes['read:authenticated'],
				PERMISSIONS.pastes['read:invited'],
				PERMISSIONS.pastes['read:private'],
			];

			if (isAdmin) {
				userPermissions.push(PERMISSIONS.pastes['read:any']);
			}
		} else {
			userPermissions = [PERMISSIONS.pastes['read:public']];
		}

		// fetch the paste to be forked
		const paste = await findPasteBySlug(forkedFromId);
		if (!paste) {
			logger.warn(`Fork attempted on non-existent paste: ${forkedFromId}`);
			return { success: false, error: 'Cannot fork paste: paste not found' };
		}

		// check if user can view the paste
		const canView = await canUserViewPaste(
			{
				id: paste.id,
				owner_id: paste.owner_id,
				visibility: paste.visibility,
			},
			user || null,
			userPermissions
		);

		if (!canView) {
			logger.warn(`Fork attempted on inaccessible paste: ${forkedFromId} by user: ${user?.id}`);
			return { success: false, error: 'Access denied to forked paste' };
		}

		// skip password-protected pastes (except for owner/admin)
		if (paste.passwordHash) {
			const isOwner = user?.id === paste.owner_id;
			if (!isOwner && !isAdmin) {
				logger.warn(`Fork attempted on password-protected paste: ${forkedFromId}`);
				return { success: false, error: 'Cannot fork password-protected pastes' };
			}
		}

		// get content (optionally from specific version)
		let effectiveContent = paste.content;
		let selectedVersion = versionParam ? parseInt(versionParam, 10) : null;
		let canViewVersions = false;

		if (paste.versioningEnabled) {
			canViewVersions = paste.owner_id === user?.id || isAdmin || paste.versionHistoryVisible;
			if (selectedVersion && canViewVersions) {
				const verContent = await getPasteVersionContent(paste.id, selectedVersion);
				if (verContent !== null) {
					effectiveContent = verContent;
				}

				if (selectedVersion > paste.currentVersion) {
					selectedVersion = paste.currentVersion;
				}
			} else {
				// can't view versions, so set selectedVersion to null
				selectedVersion = null;
			}
		}

		// get invited users if this is an INVITE_ONLY paste
		let invitedUserIds: string[] = [];
		let invitedUsersData: InvitedUser[] = [];
		if (paste.visibility === 'INVITE_ONLY') {
			const invitedUsers = await getPasteInvitedUsers(paste.id);

			// edge-case: if the current user is in the invited users list, remove them
			// when forking, they will be the owner so they don't need to invite themselves
			const filteredUsers = user?.id ? invitedUsers.filter((u) => u.id !== user.id) : invitedUsers;

			if (user?.id && filteredUsers.length < invitedUsers.length) {
				logger.debug(
					`Removed user ${user.id} from invited users list when forking paste ${paste.id}`
				);
			}

			invitedUsersData = filteredUsers;
			invitedUserIds = filteredUsers.map((u) => u.id);
		}

		return {
			success: true,
			data: {
				content: effectiveContent,
				language: paste.language || 'plaintext',
				title: paste.title || '',
				visibility: paste.visibility,
				customSlug: '', // don't copy custom slug
				versioningEnabled: paste.versioningEnabled,
				versionHistoryVisible: paste.versionHistoryVisible,
				burnAfterReading: paste.burnAfterReading,
				invitedUserIds,
				invitedUsers: invitedUsersData,
				expiresAt: paste.expiresAt,
			},
		};
	} catch (error) {
		logger.error(`Error fetching forked paste data: ${error}`);
		return { success: false, error: 'Server error: cannot fork paste' };
	}
};

/**
 * Transfer paste ownership to a new user
 */
export const transferPasteOwnership = async (
	pasteId: string,
	newOwnerId: string,
	currentOwnerId: string
): Promise<{ success: boolean; message?: string }> => {
	return await db.transaction(async (tx) => {
		// verify paste exists and current ownership
		const existingPaste = await tx
			.select({
				id: pastes.id,
				owner_id: pastes.owner_id,
				visibility: pastes.visibility,
			})
			.from(pastes)
			.where(eq(pastes.id, pasteId))
			.limit(1);

		if (existingPaste.length === 0) {
			return { success: false, message: 'Paste not found' };
		}

		const paste = existingPaste[0];

		// verify current ownership matches
		if (paste.owner_id !== currentOwnerId) {
			return { success: false, message: 'Current owner mismatch' };
		}

		// prevent transferring to the same owner
		if (currentOwnerId === newOwnerId) {
			return { success: false, message: 'Cannot transfer to the same owner' };
		}

		// verify new owner exists
		const newOwner = await tx
			.select({ id: user.id })
			.from(user)
			.where(eq(user.id, newOwnerId))
			.limit(1);

		if (newOwner.length === 0) {
			return { success: false, message: 'New owner not found' };
		}

		// update paste ownership
		await tx
			.update(pastes)
			.set({
				owner_id: newOwnerId,
				updatedAt: new Date(),
			})
			.where(eq(pastes.id, pasteId));

		// handle invite-only pastes special case
		if (paste.visibility === 'INVITE_ONLY') {
			// remove new owner from invited users list (they dont need an invite anymore)
			await tx
				.delete(pasteInvites)
				.where(and(eq(pasteInvites.pasteId, pasteId), eq(pasteInvites.userId, newOwnerId)));

			// optionally, invite the previous owner to maintain access
			// check if previous owner is already in the invite list
			const existingInvite = await tx
				.select({ id: pasteInvites.id })
				.from(pasteInvites)
				.where(and(eq(pasteInvites.pasteId, pasteId), eq(pasteInvites.userId, currentOwnerId)))
				.limit(1);

			// if previous owner is not already invited, add them
			if (existingInvite.length === 0) {
				await tx.insert(pasteInvites).values({
					pasteId: pasteId,
					userId: currentOwnerId,
					invitedBy: newOwnerId,
				});
			}
		}

		return { success: true, message: 'Ownership transferred successfully' };
	});
};
