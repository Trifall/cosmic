import { type DBUser, account, pastes, user } from '@/database/schema';
import { auth, requirePermission } from '@/src/lib/server/auth';
import { createChildLogger } from '@/src/lib/server/logger';
import { hashPassword } from 'better-auth/crypto';
import { SQL, and, count, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { type AddUserFormData, type EditUserFormData } from '$lib/auth/user-management';
import { db } from '$lib/server/db';
import type { PaginationData } from '$lib/utils/pagination';
import type { Result } from '$lib/utils/result';
import { err, ok } from '$lib/utils/result';
import { emptyToNull, getChangedFields } from '$lib/utils/update-helpers';
import { PERMISSIONS, type RoleName } from '$src/lib/auth/roles-shared';
import { isDBUser } from '$src/lib/utils/format';

const logger = createChildLogger('server/users');

/**
 * Get all users with their details with optional pagination
 * @param requestUser The user making the request (for permission check)
 * @param page - The page number (default: 1)
 * @param limit - The number of users per page (default: 20, 0 or -1 for all users)
 * @returns Promise<Result<{users: UserDetail[], total: number}, Error>> Users with their details and total count
 */
export const getAllUsersWithDetails = async (
	requestUser: DBUser,
	page = 1,
	limit = 20
): Promise<Result<{ users: DBUser[]; total: number }, Error>> => {
	try {
		// check if user has permission to view users
		await requirePermission(requestUser, {
			user: [PERMISSIONS.user.list, PERMISSIONS.user.update],
		});

		// get total count for pagination
		const totalResult = await db.select({ count: sql<number>`count(*)` }).from(user);
		const total = totalResult[0]?.count || 0;

		// special case: if limit is 0 or -1, return all users without pagination
		if (limit <= 0) {
			// get all users
			const usersResult = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
					username: user.username,
					displayUsername: user.displayUsername,
					image: user.image,
					role: user.role,
					banned: user.banned,
					banReason: user.banReason,
					banExpires: user.banExpires,
				})
				.from(user)
				.orderBy(desc(user.createdAt));

			return ok({ users: usersResult, total });
		}

		// calculate offset based on page and limit for normal pagination
		const offset = (page - 1) * limit;

		// get users with pagination
		const usersResult = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
				username: user.username,
				displayUsername: user.displayUsername,
				image: user.image,
				role: user.role,
				banned: user.banned,
				banReason: user.banReason,
				banExpires: user.banExpires,
			})
			.from(user)
			.orderBy(desc(user.createdAt))
			.limit(limit)
			.offset(offset);

		return ok({ users: usersResult, total });
	} catch (error) {
		logger.error(`Error getting users with details: ${error}`);
		return err(error instanceof Error ? error : new Error('Failed to get users'));
	}
};

/**
 * Get all users with pagination and optional search (admin only)
 * Supports searching by username, email, and user ID, plus filtering by banned status
 */
export const getAllUsersWithPagination = async (
	requestUser: DBUser,
	page: number = 1,
	limit: number = 10,
	search?: string,
	bannedOnly?: boolean
): Promise<Result<{ users: DBUser[]; pagination: PaginationData }, Error>> => {
	try {
		// check if user has permission to view users
		await requirePermission(requestUser, {
			user: [PERMISSIONS.user.list, PERMISSIONS.user.update],
		});

		const offset = (page - 1) * limit;

		// build search condition
		let whereCondition: SQL<unknown> | undefined = undefined;

		if (search) {
			// search across username and email, only include ID if search term is long enough (32+ chars)
			const searchConditions = [
				ilike(user.username, `%${search}%`),
				ilike(user.email, `%${search}%`),
			];

			// only search by ID if query is around ID length (32 characters)
			if (search.length >= 32) {
				searchConditions.push(ilike(user.id, `%${search}%`));
			}

			whereCondition = or(...searchConditions);
		}

		// add banned filter if specified
		if (bannedOnly) {
			const bannedCondition = eq(user.banned, true);
			whereCondition = whereCondition ? and(whereCondition, bannedCondition) : bannedCondition;
		}

		// get total count for pagination
		const [totalResult] = await db.select({ count: count() }).from(user).where(whereCondition);

		const total = totalResult.count;
		const totalPages = Math.ceil(total / limit);

		// get paginated results
		const usersResult = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
				username: user.username,
				displayUsername: user.displayUsername,
				image: user.image,
				role: user.role,
				banned: user.banned,
				banReason: user.banReason,
				banExpires: user.banExpires,
			})
			.from(user)
			.where(whereCondition)
			.orderBy(desc(user.createdAt))
			.limit(limit)
			.offset(offset);

		const pagination: PaginationData = {
			page,
			limit,
			total,
			totalPages,
		};

		return ok({ users: usersResult, pagination });
	} catch (error) {
		logger.error(`Error getting users with pagination: ${error}`);
		return err(error instanceof Error ? error : new Error('Failed to get users'));
	}
};

/**
 * Get user details by ID
 * @param requestUser The user making the request (for permission check)
 * @param userId The ID of the user to get details for
 * @returns Promise<Result<DBUser | null, Error>> The user details, or null if not found
 */
export const getUserDetailsById = async (
	requestUser: DBUser,
	userId: string
): Promise<Result<DBUser | null, Error>> => {
	try {
		// check if user has permission to view users
		if (!isDBUser(requestUser) || requestUser.id !== userId) {
			await requirePermission(requestUser, { user: [PERMISSIONS.user['get:any']] });
		}

		// get user
		const userResult = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
				username: user.username,
				displayUsername: user.displayUsername,
				image: user.image,
				role: user.role,
				banned: user.banned,
				banReason: user.banReason,
				banExpires: user.banExpires,
			})
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (userResult.length === 0) {
			return ok(null);
		}

		return ok(userResult[0] as DBUser);
	} catch (error) {
		logger.error(`Error getting user details by ID: ${error}`);
		return err(error instanceof Error ? error : new Error('Failed to get user details'));
	}
};

/**
 * Create a new user
 * @param requestUser The user making the request (for permission check)
 * @param data The data for the new user
 * @returns Promise<Result<{ userId: string }, Error>> The ID of the new user
 */
export const createUser = async (
	requestUser: DBUser,
	data: AddUserFormData
): Promise<Result<{ userId: string }, Error>> => {
	try {
		// check if user has permission to add users
		await requirePermission(requestUser, { user: [PERMISSIONS.user.create] });

		// use better-auth's admin API to create the user with proper password hashing
		const result = await auth.api.createUser({
			body: {
				email: data.email,
				password: data.password,
				name: data.username,
				role: data.role as RoleName,
				data: {
					username: data.username,
					displayUsername: data.username,
					isAdminCreated: true, // flag to distinguish from public signups
				},
			},
		});

		if (!result || !result.user) {
			return err(new Error('Failed to create user'));
		}

		return ok({ userId: result.user.id });
	} catch (error) {
		logger.error(`Error creating user: ${error}`);

		// handle specific better-auth errors
		if (error instanceof Error) {
			if (error.message.includes('User already exists')) {
				return err(new Error(`User with email '${data.email}' already exists`));
			}
			if (error.message.includes('Username already exists')) {
				return err(new Error(`User with username '${data.username}' already exists`));
			}
		}

		return err(error instanceof Error ? error : new Error('Failed to create user'));
	}
};

/**
 * Update an existing user
 * @param requestUser The user making the request (for permission check)
 * @param userId The ID of the user to update
 * @param data The new data for the user
 * @returns Promise<Result<void, Error>> Result of the operation
 */
export const updateUser = async (
	requestUser: DBUser,
	userId: string,
	data: EditUserFormData
): Promise<Result<void, Error>> => {
	try {
		// check if user has permission to edit users
		// allow users to edit their own profile
		if (isDBUser(requestUser) && requestUser.id === userId) {
			// user is editing their own profile
			// fetch current user data to check if role is being changed
			const existingUserResult = await db
				.select({
					role: user.role,
				})
				.from(user)
				.where(eq(user.id, userId))
				.limit(1);

			if (existingUserResult.length === 0) {
				return err(new Error(`User with ID ${userId} not found`));
			}

			const currentUser = existingUserResult[0];

			// check if role is being changed - dont allow changing role of self
			if (currentUser.role && currentUser.role !== data.role) {
				return err(new Error('You cannot change your own role'));
			}
		} else {
			await requirePermission(requestUser, { user: [PERMISSIONS.user.update] });
		}

		return await db.transaction(async (tx) => {
			// fetch current user data for comparison
			const existingUserResult = await tx
				.select({
					id: user.id,
					email: user.email,
					username: user.username,
					role: user.role,
					banned: user.banned,
					banReason: user.banReason,
					banExpires: user.banExpires,
				})
				.from(user)
				.where(eq(user.id, userId))
				.limit(1);

			const currentUser = existingUserResult[0];

			// validate uniqueness constraints for changed fields
			const conflicts = await Promise.all([
				// check email conflict if changed
				data.email !== undefined && data.email !== currentUser.email
					? tx
							.select({ id: user.id })
							.from(user)
							.where(and(eq(user.email, data.email!), ne(user.id, userId)))
							.limit(1)
					: Promise.resolve([]),
				// check username conflict if changed
				data.username !== undefined && data.username !== currentUser.username
					? tx
							.select({ id: user.id })
							.from(user)
							.where(and(eq(user.username, data.username.toLowerCase()), ne(user.id, userId)))
							.limit(1)
					: Promise.resolve([]),
			]);

			if (conflicts[0].length > 0) {
				return err(new Error(`Another user with email '${data.email}' already exists`));
			}
			if (conflicts[1].length > 0) {
				return err(new Error(`Another user with username '${data.username}' already exists`));
			}

			// use helper to detect all field changes, including complex multi-field updates
			const userUpdateFields = getChangedFields(
				currentUser,
				{
					email: data.email,
					role: data.role,
					username: data.username,
					banned: data.banned,
					banReason: data.banReason,
				},
				{
					email: { transform: emptyToNull },
					// username change affects multiple fields
					username: {
						map: (value) => ({
							username: (value as string).toLowerCase(),
							displayUsername: value as string,
							name: value as string,
						}),
					},
					// ban status affects multiple related fields
					// also triggers when banReason changes
					banned: {
						map: (value) => ({
							banned: value as boolean,
							banReason: value ? data.banReason || null : null,
							banExpires: value ? null : null,
						}),
						dependsOn: ['banReason'], // re-run map if banReason changes
					},
				},
				['email', 'role', 'username', 'banned']
			);

			logger.debug(
				`Updating user ${userId} with fields: ${JSON.stringify(userUpdateFields, null, 2)}`
			);

			const hasUserChanges = Object.keys(userUpdateFields).length > 0;

			// apply user table updates if any fields changed
			if (hasUserChanges) {
				await tx.update(user).set(userUpdateFields).where(eq(user.id, userId));
			}

			// password changes - update in account table (Better Auth pattern)
			if (data.newPassword) {
				const hashedPassword = await hashPassword(data.newPassword);
				await tx
					.update(account)
					.set({
						password: hashedPassword,
						updatedAt: new Date(),
					})
					.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
			}

			return ok(undefined);
		});
	} catch (error) {
		logger.error(`Error updating user: ${error}`);
		return err(error instanceof Error ? error : new Error('Failed to update user'));
	}
};

/**
 * Delete a user by ID
 * @param requestUser The user making the request (for permission check)
 * @param userId The ID of the user to delete
 * @returns Promise<Result<void, Error>> Result of the operation
 */
export const deleteUser = async (
	requestUser: DBUser,
	userId: string
): Promise<Result<void, Error>> => {
	try {
		// check if user has permission to delete users
		await requirePermission(requestUser, { user: [PERMISSIONS.user.delete] });

		// check if user exists
		const userResult = await getUserDetailsById(requestUser, userId);
		if (!userResult.ok) {
			return err(userResult.error);
		}

		if (!userResult.value) {
			return err(new Error(`User with ID ${userId} not found`));
		}

		// check if user is trying to delete themselves
		if (isDBUser(requestUser) && requestUser.id === userId) {
			return err(new Error('You cannot delete your own account'));
		}

		// delete the user
		await db.delete(user).where(eq(user.id, userId));

		return ok(undefined);
	} catch (error) {
		logger.error(`Error deleting user: ${error}`);
		return err(error instanceof Error ? error : new Error('Failed to delete user'));
	}
};

/**
 * Type for detailed user statistics
 */
export type IndividualUserStatistics = {
	totalPastes: number;
	publicPastes: number;
	privatePastes: number;
	authenticatedPastes: number;
	inviteOnlyPastes: number;
	totalViews: number;
	totalUniqueViews: number;
	averageViewsPerPaste: number;
	mostViewedPaste: {
		id: string;
		title?: string;
		views: number;
		visibility: string;
		createdAt: Date;
		customSlug?: string;
	} | null;
	recentPastes: Array<{
		id: string;
		title?: string;
		language?: string;
		visibility: string;
		views: number;
		createdAt: Date;
		customSlug?: string;
	}>;
	languageDistribution: Array<{
		language: string;
		count: number;
	}>;
	accountAge: {
		days: number;
		months: number;
		years: number;
	};
	lastActivity: Date | null;
};

/**
 * Get comprehensive statistics for a specific user
 * @param requestUser The user making the request (for permission check)
 * @param userId The ID of the user to get statistics for
 * @returns Promise<Result<UserStatistics, Error>> Comprehensive user statistics
 */
export const getIndividualUserStatistics = async (
	requestUser: DBUser,
	userId: string
): Promise<Result<IndividualUserStatistics, Error>> => {
	try {
		// check if user has permission to view users
		if (!isDBUser(requestUser) || requestUser.id !== userId) {
			// if user is attempting to view someone else's statistics, they need to have the appropriate permission
			await requirePermission(requestUser, { user: [PERMISSIONS.user['get:any']] });
		}

		// get user details first to calculate account age
		const userDetails = await getUserDetailsById(requestUser, userId);
		if (!userDetails.ok || !userDetails.value) {
			return err(new Error('User not found'));
		}

		const user = userDetails.value;

		// calculate account age
		const accountCreated = new Date(user.createdAt);
		const now = new Date();
		const ageInMs = now.getTime() - accountCreated.getTime();
		const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
		const ageInMonths = Math.floor(ageInDays / 30);
		const ageInYears = Math.floor(ageInDays / 365);

		// get total paste statistics
		const pasteStats = await db
			.select({
				totalPastes: sql<number>`count(*)`,
				publicPastes: sql<number>`count(*) filter (where visibility = 'PUBLIC')`,
				privatePastes: sql<number>`count(*) filter (where visibility = 'PRIVATE')`,
				authenticatedPastes: sql<number>`count(*) filter (where visibility = 'AUTHENTICATED')`,
				inviteOnlyPastes: sql<number>`count(*) filter (where visibility = 'INVITE_ONLY')`,
				totalViews: sql<number>`coalesce(sum(views), 0)`,
				totalUniqueViews: sql<number>`coalesce(sum(unique_views), 0)`,
				lastActivity: sql<Date>`max(updated_at)`,
			})
			.from(pastes)
			.where(eq(pastes.owner_id, userId));

		const stats = pasteStats[0];
		if (!stats) {
			return err(new Error('Failed to fetch paste statistics'));
		}

		// calculate average views per paste
		const averageViewsPerPaste = stats.totalPastes > 0 ? stats.totalViews / stats.totalPastes : 0;

		// get most viewed paste
		const mostViewedResult = await db
			.select({
				id: pastes.id,
				title: pastes.title,
				views: pastes.views,
				visibility: pastes.visibility,
				createdAt: pastes.createdAt,
				customSlug: pastes.customSlug,
			})
			.from(pastes)
			.where(eq(pastes.owner_id, userId))
			.orderBy(desc(pastes.views))
			.limit(1);

		const mostViewedPaste = mostViewedResult[0] || null;

		// get recent pastes (last 5)
		const recentPastesResult = await db
			.select({
				id: pastes.id,
				title: pastes.title,
				language: pastes.language,
				visibility: pastes.visibility,
				views: pastes.views,
				createdAt: pastes.createdAt,
				customSlug: pastes.customSlug,
			})
			.from(pastes)
			.where(eq(pastes.owner_id, userId))
			.orderBy(desc(pastes.createdAt))
			.limit(5);

		// get language distribution
		const languageDistResult = await db
			.select({
				language: pastes.language,
				count: sql<number>`count(*)`,
			})
			.from(pastes)
			.where(eq(pastes.owner_id, userId))
			.groupBy(pastes.language)
			.orderBy(desc(sql<number>`count(*)`))
			.limit(10);

		const statistics: IndividualUserStatistics = {
			totalPastes: stats.totalPastes,
			publicPastes: stats.publicPastes,
			privatePastes: stats.privatePastes,
			authenticatedPastes: stats.authenticatedPastes,
			inviteOnlyPastes: stats.inviteOnlyPastes,
			totalViews: stats.totalViews,
			totalUniqueViews: stats.totalUniqueViews,
			averageViewsPerPaste: Math.round(averageViewsPerPaste * 100) / 100, // round to 2 decimal
			mostViewedPaste: mostViewedPaste
				? {
						id: mostViewedPaste.id,
						title: mostViewedPaste.title || undefined,
						views: mostViewedPaste.views,
						visibility: mostViewedPaste.visibility,
						createdAt: mostViewedPaste.createdAt,
					}
				: null,
			recentPastes: recentPastesResult.map((paste) => ({
				id: paste.id,
				title: paste.title || undefined,
				language: paste.language || undefined,
				visibility: paste.visibility,
				views: paste.views,
				createdAt: paste.createdAt,
				customSlug: paste.customSlug || undefined,
			})),
			languageDistribution: languageDistResult.map((lang) => ({
				language: lang.language || 'plaintext',
				count: lang.count,
			})),
			accountAge: {
				days: ageInDays,
				months: ageInMonths,
				years: ageInYears,
			},
			lastActivity: stats.lastActivity,
		};

		return ok(statistics);
	} catch (error) {
		logger.error(`Error getting user statistics: ${error}`);
		return err(error instanceof Error ? error : new Error('Failed to get user statistics'));
	}
};
