import { createChildLogger } from '@/src/lib/server/logger';
import {
	type PasteStatistics,
	clearStatsCache,
	getLastBackupTime,
	getPasteStatistics,
	getSessionStats,
	getUserStats,
} from '$lib/server/stats';
import { getServerUptime } from '$lib/server/system';
import { getSetting } from '$src/lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

const logger = createChildLogger('AdminPage');

/**
 * Server-side load function for the admin dashboard
 * Fetches server uptime, job stats, user stats, and paste statistics
 */
export const load: PageServerLoad = async ({ parent }) => {
	// get server uptime - not async
	const uptime = getServerUptime();
	const { user } = await parent();

	const defaultUserStats = { totalUsers: 0 };
	const defaultSessionStats = { totalSessions: 0 };
	const defaultPasteStats = null;
	const defaultLastBackup: { lastBackup: Date | null } = { lastBackup: null };

	// run stats concurrently
	const [
		userStatsResult,
		sessionStatsResult,
		pasteStatsResult,
		lastBackupResult,
		filesystemBackupEnabled,
		s3BackupEnabled,
		r2BackupEnabled,
	] = await Promise.all([
		// user stats promise
		getUserStats(user).catch((error) => {
			logger.error(`Error fetching user stats: ${error}`);
			return { ok: false, error: String(error) };
		}),

		// session stats promise
		getSessionStats(user).catch((error) => {
			logger.error(`Error fetching session stats: ${error}`);
			return { ok: false, error: String(error) };
		}),

		// paste stats promise
		getPasteStatistics(user).catch((error) => {
			logger.error(`Error fetching paste stats: ${error}`);
			return { ok: false, error: String(error) };
		}),

		// last backup time promise
		getLastBackupTime(user).catch((error) => {
			logger.error(`Error fetching last backup time: ${error}`);
			return { ok: false, error: String(error) };
		}),
		// filesystem backup enabled promise
		getSetting('filesystemBackupEnabled').catch((error) => {
			logger.error(`Error fetching filesystem backup enabled: ${error}`);
			return false;
		}),
		// s3 backup enabled promise
		getSetting('s3BackupEnabled').catch((error) => {
			logger.error(`Error fetching s3 backup enabled: ${error}`);
			return false;
		}),
		// r2 backup enabled promise
		getSetting('r2BackupEnabled').catch((error) => {
			logger.error(`Error fetching r2 backup enabled: ${error}`);
			return false;
		}),
	]);

	// process user stats result
	let userStats = defaultUserStats;
	if (
		userStatsResult &&
		'ok' in userStatsResult &&
		userStatsResult.ok &&
		'value' in userStatsResult
	) {
		userStats = userStatsResult.value;
	} else if (userStatsResult && 'error' in userStatsResult) {
		logger.error(`Error in user stats result: ${userStatsResult.error}`);
	}

	// process session stats result
	let sessionStats = defaultSessionStats;
	if (
		sessionStatsResult &&
		'ok' in sessionStatsResult &&
		sessionStatsResult.ok &&
		'value' in sessionStatsResult
	) {
		sessionStats = sessionStatsResult.value;
	} else if (sessionStatsResult && 'error' in sessionStatsResult) {
		logger.error(`Error in session stats result: ${sessionStatsResult.error}`);
	}

	// process paste stats result
	let pasteStats: PasteStatistics | null = defaultPasteStats;
	if (
		pasteStatsResult &&
		'ok' in pasteStatsResult &&
		pasteStatsResult.ok &&
		'value' in pasteStatsResult
	) {
		pasteStats = pasteStatsResult.value;
	} else if (pasteStatsResult && 'error' in pasteStatsResult) {
		logger.error(`Error in paste stats result: ${pasteStatsResult.error}`);
	}

	// process last backup result
	let lastBackup = defaultLastBackup;
	if (
		lastBackupResult &&
		'ok' in lastBackupResult &&
		lastBackupResult.ok &&
		'value' in lastBackupResult
	) {
		lastBackup = lastBackupResult.value;
	} else if (lastBackupResult && 'error' in lastBackupResult) {
		logger.error(`Error in last backup result: ${lastBackupResult.error}`);
	}

	return {
		uptime,
		userStats,
		sessionStats,
		pasteStats,
		lastBackup: lastBackup.lastBackup,
		filesystemBackupEnabled,
		s3BackupEnabled,
		r2BackupEnabled,
	};
};

export const actions: Actions = {
	// clear the stats cache and reload data
	refreshStats: async () => {
		logger.debug('Clearing stats cache via form action');
		clearStatsCache();
		return { success: true };
	},
};
