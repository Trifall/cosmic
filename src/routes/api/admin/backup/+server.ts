import { createChildLogger } from '@/src/lib/server/logger';
import { json } from '@sveltejs/kit';
import { triggerManualBackup } from '$lib/server/backups/backup-handler';
import { BackupScheduler } from '$lib/server/backups/backup-scheduler';
import type { RequestHandler } from './$types';

const logger = createChildLogger('BackupAPI');

export const POST: RequestHandler = async ({ locals }) => {
	// check if user is admin
	if (!locals.isAdmin) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const result = await triggerManualBackup();
		return json(result);
	} catch (error) {
		logger.error(`Manual backup failed: ${error}`);
		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Unknown error occurred',
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ locals }) => {
	// check if user is admin
	if (!locals.isAdmin) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const backupScheduler = BackupScheduler.getInstance();
		const status = backupScheduler.getStatus();

		return json({
			success: true,
			scheduler: status,
		});
	} catch (error) {
		logger.error(`Failed to get backup status: ${error}`);
		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Unknown error occurred',
			},
			{ status: 500 }
		);
	}
};
