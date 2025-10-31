import { error } from '@sveltejs/kit';
import { command, getRequestEvent } from '$app/server';
import { triggerManualBackup } from '$lib/server/backups/backup-handler';

/**
 * Remote function to trigger a manual database backup
 * Admin-only command
 */
export const triggerBackup = command(async () => {
	const event = getRequestEvent();

	// ensure user is authenticated and is an admin
	if (!event.locals.user || event.locals.user.role !== 'admin') {
		error(403, 'Unauthorized - Admin access required');
	}

	try {
		const result = await triggerManualBackup();

		if (!result.success) {
			error(500, result.message || 'Backup failed');
		}

		return {
			success: true,
			message: result.message,
		};
	} catch (err) {
		console.error('Manual backup failed:', err);
		error(500, err instanceof Error ? err.message : 'Unknown error occurred during backup');
	}
});
