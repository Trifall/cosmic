import { type DBUser, logs, pastes, session, user } from '@/database/schema';
import { requirePermission } from '@/src/lib/server/auth';
import { createChildLogger } from '@/src/lib/server/logger';
import { desc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { Result } from '$lib/utils/result';
import { err, ok } from '$lib/utils/result';
import { PERMISSIONS } from '$src/lib/auth/roles-shared';

const logger = createChildLogger('server/stats');

// cache configuration
const CACHE_TTL_MS = 60 * 1000; // 1 minute

// cache entries with timestamp
type CacheEntry<T> = {
	data: T;
	timestamp: number;
};

// in-memory cache for stats
const statsCache = {
	pasteStats: null as CacheEntry<PasteStatistics> | null,
	userStats: null as CacheEntry<{ totalUsers: number }> | null,
	sessionStats: null as CacheEntry<{ totalSessions: number }> | null,
	lastBackup: null as CacheEntry<{ lastBackup: Date | null }> | null,
};

// Clear all cached statistics
export const clearStatsCache = () => {
	statsCache.pasteStats = null;
	statsCache.userStats = null;
	statsCache.sessionStats = null;
	statsCache.lastBackup = null;
	logger.debug('Stats cache cleared');
};

/**
 * Check if a cache entry is valid (not expired)
 */
const isCacheValid = <T>(entry: CacheEntry<T> | null): boolean => {
	if (!entry) return false;
	const age = Date.now() - entry.timestamp;
	return age < CACHE_TTL_MS;
};

/**
 * Type for comprehensive paste statistics
 */
export type PasteStatistics = {
	totalPastes: number;
	totalViews: number;
	totalUniqueViews: number;
	averageViewsPerPaste: number;
	authedPastes: number;
	unauthedPastes: number;
	visibilityBreakdown: {
		PUBLIC: number;
		AUTHENTICATED: number;
		INVITE_ONLY: number;
		PRIVATE: number;
	};
	languageDistribution: Array<{
		language: string;
		count: number;
	}>;
	mostViewedPaste: {
		id: string;
		title?: string;
		views: number;
		visibility: string;
		createdAt: Date;
		customSlug?: string;
		ownerUsername: string | null;
	} | null;
	mostActiveUsers: Array<{
		userId: string;
		username: string;
		displayUsername: string | null;
		pasteCount: number;
	}>;
	recentActivity: {
		last24h: number;
		last7d: number;
		last30d: number;
	};
	passwordProtectedCount: number;
};

/**
 * Get comprehensive paste statistics for the admin dashboard
 * @param requestUser The user making the request (for permission check)
 * @returns Promise<Result<PasteStatistics, Error>> Comprehensive paste statistics
 */
export const getPasteStatistics = async (
	requestUser: DBUser
): Promise<Result<PasteStatistics, Error>> => {
	try {
		// check if user has permission to view statistics
		await requirePermission(requestUser, { user: [PERMISSIONS.user.list] });

		// return cached data if valid
		if (isCacheValid(statsCache.pasteStats)) {
			return ok(statsCache.pasteStats!.data);
		}

		// use a single CTE query to get multiple aggregations efficiently
		const basicStats = await db
			.select({
				totalPastes: sql<number>`count(*)`,
				totalViews: sql<number>`coalesce(sum(${pastes.views}), 0)`,
				totalUniqueViews: sql<number>`coalesce(sum(${pastes.uniqueViews}), 0)`,
				authedPastes: sql<number>`count(*) filter (where ${pastes.owner_id} is not null)`,
				unauthedPastes: sql<number>`count(*) filter (where ${pastes.owner_id} is null)`,
				publicPastes: sql<number>`count(*) filter (where ${pastes.visibility} = 'PUBLIC')`,
				authenticatedPastes: sql<number>`count(*) filter (where ${pastes.visibility} = 'AUTHENTICATED')`,
				inviteOnlyPastes: sql<number>`count(*) filter (where ${pastes.visibility} = 'INVITE_ONLY')`,
				privatePastes: sql<number>`count(*) filter (where ${pastes.visibility} = 'PRIVATE')`,
				passwordProtectedCount: sql<number>`count(*) filter (where ${pastes.passwordHash} is not null)`,
			})
			.from(pastes);

		const stats = basicStats[0];
		if (!stats) {
			return err(new Error('Failed to fetch paste statistics'));
		}

		// calculate average views per paste
		const averageViewsPerPaste = stats.totalPastes > 0 ? stats.totalViews / stats.totalPastes : 0;

		// get most viewed paste with owner information
		const mostViewedResult = await db
			.select({
				id: pastes.id,
				title: pastes.title,
				views: pastes.views,
				visibility: pastes.visibility,
				createdAt: pastes.createdAt,
				customSlug: pastes.customSlug,
				ownerUsername: user.username,
			})
			.from(pastes)
			.leftJoin(user, eq(pastes.owner_id, user.id))
			.orderBy(desc(pastes.views))
			.limit(1);

		const mostViewedPaste = mostViewedResult[0] || null;

		// get language distribution (top 10)
		const languageDistResult = await db
			.select({
				language: pastes.language,
				count: sql<number>`count(*)`,
			})
			.from(pastes)
			.groupBy(pastes.language)
			.orderBy(desc(sql<number>`count(*)`))
			.limit(10);

		// get most active users (top 5 by paste count)
		const mostActiveUsersResult = await db
			.select({
				userId: user.id,
				username: user.username,
				displayUsername: user.displayUsername,
				pasteCount: sql<number>`count(${pastes.id})`,
			})
			.from(user)
			.innerJoin(pastes, eq(user.id, pastes.owner_id))
			.where(isNotNull(pastes.owner_id))
			.groupBy(user.id, user.username, user.displayUsername)
			.orderBy(desc(sql<number>`count(${pastes.id})`))
			.limit(5);

		// get recent activity counts (24h, 7d, 30d)
		const now = new Date();
		const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		const recentActivityResult = await db
			.select({
				last24h: sql<number>`count(*) filter (where ${pastes.createdAt} >= ${last24h.toISOString()})`,
				last7d: sql<number>`count(*) filter (where ${pastes.createdAt} >= ${last7d.toISOString()})`,
				last30d: sql<number>`count(*) filter (where ${pastes.createdAt} >= ${last30d.toISOString()})`,
			})
			.from(pastes);

		const recentActivity = recentActivityResult[0] || {
			last24h: 0,
			last7d: 0,
			last30d: 0,
		};

		const statistics: PasteStatistics = {
			totalPastes: stats.totalPastes,
			totalViews: stats.totalViews,
			totalUniqueViews: stats.totalUniqueViews,
			averageViewsPerPaste: Math.round(averageViewsPerPaste * 100) / 100, // round to 2 decimals
			authedPastes: stats.authedPastes,
			unauthedPastes: stats.unauthedPastes,
			visibilityBreakdown: {
				PUBLIC: stats.publicPastes,
				AUTHENTICATED: stats.authenticatedPastes,
				INVITE_ONLY: stats.inviteOnlyPastes,
				PRIVATE: stats.privatePastes,
			},
			languageDistribution: languageDistResult.map((lang) => ({
				language: lang.language || 'plaintext',
				count: lang.count,
			})),
			mostViewedPaste: mostViewedPaste
				? {
						id: mostViewedPaste.id,
						title: mostViewedPaste.title || undefined,
						views: mostViewedPaste.views,
						visibility: mostViewedPaste.visibility,
						createdAt: mostViewedPaste.createdAt,
						customSlug: mostViewedPaste.customSlug || undefined,
						ownerUsername: mostViewedPaste.ownerUsername || 'Guest',
					}
				: null,
			mostActiveUsers: mostActiveUsersResult.map((userItem) => ({
				userId: userItem.userId,
				username: userItem.username,
				displayUsername: userItem.displayUsername,
				pasteCount: userItem.pasteCount,
			})),
			recentActivity: {
				last24h: recentActivity.last24h,
				last7d: recentActivity.last7d,
				last30d: recentActivity.last30d,
			},
			passwordProtectedCount: stats.passwordProtectedCount,
		};

		// cache the result
		statsCache.pasteStats = {
			data: statistics,
			timestamp: Date.now(),
		};

		return ok(statistics);
	} catch (error) {
		logger.error(`Error getting paste statistics: ${error}`);
		return err(error instanceof Error ? error : new Error('Failed to get paste statistics'));
	}
};

/**
 * Get user statistics for the admin dashboard
 * @param requestUser The user making the request (for permission check)
 * @returns Promise<Result<{ totalUsers: number }, Error>> The total count of users
 */
export const getUserStats = async (
	requestUser: DBUser
): Promise<Result<{ totalUsers: number }, Error>> => {
	try {
		// check if user has permission to view users
		await requirePermission(requestUser, { user: [PERMISSIONS.user.list] });

		// return cached data if valid
		if (isCacheValid(statsCache.userStats)) {
			return ok(statsCache.userStats!.data);
		}

		// get total user count
		const totalResult = await db.select({ count: sql<number>`count(*)` }).from(user);
		const totalUsers = totalResult[0]?.count || 0;

		const result = { totalUsers };

		// cache the result
		statsCache.userStats = {
			data: result,
			timestamp: Date.now(),
		};

		return ok(result);
	} catch (error) {
		logger.error(`Error getting user stats: ${error}`);
		return err(error instanceof Error ? error : new Error('Failed to get user stats'));
	}
};

/**
 * Get total session count for the admin dashboard
 * @param requestUser The user making the request (for permission check)
 * @returns Promise<Result<{ totalSessions: number }, Error>> The total count of sessions
 */
export const getSessionStats = async (
	requestUser: DBUser
): Promise<Result<{ totalSessions: number }, Error>> => {
	try {
		// check if user has permission to view users
		await requirePermission(requestUser, { user: [PERMISSIONS.user.list] });

		// return cached data if valid
		if (isCacheValid(statsCache.sessionStats)) {
			return ok(statsCache.sessionStats!.data);
		}

		// get total session count (excluding expired sessions)
		const totalResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(session)
			.where(gt(session.expiresAt, new Date()));
		const totalSessions = totalResult[0]?.count || 0;

		const result = { totalSessions };

		// cache the result
		statsCache.sessionStats = {
			data: result,
			timestamp: Date.now(),
		};

		return ok(result);
	} catch (error) {
		logger.error(`Error getting session stats: ${error}`);
		return err(error instanceof Error ? error : new Error('Failed to get session stats'));
	}
};

/**
 * Get the timestamp of the last successful database backup
 * @param requestUser The user making the request (for permission check)
 * @returns Promise<Result<{ lastBackup: Date | null }, Error>> The timestamp of the last backup or null if none found
 */
export const getLastBackupTime = async (
	requestUser: DBUser
): Promise<Result<{ lastBackup: Date | null }, Error>> => {
	try {
		// check if user has permission to view users
		await requirePermission(requestUser, { user: [PERMISSIONS.user.list] });

		// return cached data if valid
		if (isCacheValid(statsCache.lastBackup)) {
			return ok(statsCache.lastBackup!.data);
		}

		// get the most recent backup log entry
		const lastBackupLog = await db
			.select({ timestamp: logs.timestamp })
			.from(logs)
			.where(eq(logs.source, 'DatabaseBackup'))
			.orderBy(desc(logs.timestamp))
			.limit(1);

		const lastBackup = lastBackupLog[0]?.timestamp || null;
		const result = { lastBackup };

		// cache the result
		statsCache.lastBackup = {
			data: result,
			timestamp: Date.now(),
		};

		return ok(result);
	} catch (error) {
		logger.error(`Error getting last backup time: ${error}`);
		return err(error instanceof Error ? error : new Error('Failed to get last backup time'));
	}
};
