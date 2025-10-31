import { Cron } from 'croner';
import type { Logger } from 'winston';
import { createChildLogger } from '$lib/server/logger';
import { getSetting } from '$lib/server/settings';
import { performDatabaseBackup } from './backup-handler';

/**
 * Manages automatic backup scheduling using cron expressions.
 * Implemented as a singleton to ensure only one instance runs.
 */
export class BackupScheduler {
	private static instance: BackupScheduler | null = null;
	private backupJob: Cron | null = null;
	private readonly logger: Logger;

	private constructor() {
		this.logger = createChildLogger('BackupScheduler');
		// private constructor for singleton pattern
	}

	/**
	 * Get the singleton instance of BackupScheduler.
	 */
	public static getInstance(): BackupScheduler {
		if (!BackupScheduler.instance) {
			BackupScheduler.instance = new BackupScheduler();
		}
		return BackupScheduler.instance;
	}

	/**
	 * Starts the backup scheduler based on settings from the database.
	 */
	public async start(): Promise<void> {
		if (this.backupJob) {
			this.logger.warn('Backup scheduler is already running.');
			return;
		}

		try {
			const filesystemEnabled = await getSetting('filesystemBackupEnabled');
			const s3Enabled = await getSetting('s3BackupEnabled');
			const r2Enabled = await getSetting('r2BackupEnabled');

			if (!filesystemEnabled && !s3Enabled && !r2Enabled) {
				this.logger.info(
					'All backup methods (filesystem, S3, and R2) are disabled via settings. Will not start backup scheduler.'
				);
				return;
			}

			const cronPattern = await getSetting('backupCronPattern');
			this.logger.info(`Starting backup scheduler with pattern: "${cronPattern}"`);

			// validate cron pattern before creating the job
			try {
				// create a test cron to validate the pattern
				const testCron = new Cron(cronPattern, () => {});
				testCron.stop();
			} catch (error) {
				throw new Error(`Invalid cron pattern "${cronPattern}": ${error}`);
			}

			this.backupJob = new Cron(cronPattern, async () => {
				this.logger.info('Triggering scheduled database backup...');
				const startTime = Date.now();

				try {
					await performDatabaseBackup();
					const duration = Date.now() - startTime;
					this.logger.info(`Scheduled database backup completed successfully in ${duration}ms`);
				} catch (error) {
					const duration = Date.now() - startTime;
					this.logger.error(`Scheduled database backup failed after ${duration}ms:`, error);
				}
			});

			this.logger.info('Backup scheduler started successfully');
		} catch (error) {
			this.logger.error(`Failed to start backup scheduler: ${error}`);
			throw error;
		}
	}

	/**
	 * Stops the backup scheduler.
	 */
	public stop(): void {
		if (this.backupJob) {
			this.backupJob.stop();
			this.backupJob = null;
			this.logger.info('Backup scheduler stopped.');
		} else {
			this.logger.info('Backup scheduler was not running.');
		}
	}

	/**
	 * Restarts the backup scheduler with updated settings
	 */
	public async restart(): Promise<void> {
		this.logger.info('Restarting backup scheduler...');
		this.stop();
		await this.start();
	}

	/**
	 * Gets the current status of the backup scheduler
	 */
	public getStatus(): {
		isRunning: boolean;
		nextRun: Date | null;
		cronPattern: string | null;
	} {
		if (!this.backupJob) {
			return {
				isRunning: false,
				nextRun: null,
				cronPattern: null,
			};
		}

		return {
			isRunning: true,
			nextRun: this.backupJob.nextRun(),
			cronPattern: this.backupJob.getPattern() || null,
		};
	}

	/**
	 * Updates the backup schedule with new settings
	 * @param filesystemEnabled - Whether file system backups should be enabled
	 * @param s3Enabled - Whether S3 backups should be enabled
	 * @param r2Enabled - Whether R2 backups should be enabled
	 * @param cronPattern - New cron pattern for scheduling
	 */
	public async updateSchedule(
		filesystemEnabled: boolean,
		s3Enabled: boolean,
		r2Enabled: boolean,
		cronPattern?: string
	): Promise<void> {
		if (!filesystemEnabled && !s3Enabled && !r2Enabled) {
			this.stop();
			this.logger.info(
				'Backup scheduler disabled via settings update (all backup methods disabled)'
			);
			return;
		}

		// if already running with the same pattern, no need to restart
		if (this.backupJob && cronPattern && this.backupJob.getPattern() === cronPattern) {
			this.logger.info('Backup scheduler already running with same pattern, no restart needed');
			return;
		}

		// restart with new settings
		await this.restart();
	}
}
