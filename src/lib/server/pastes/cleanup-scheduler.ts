import { Cron } from 'croner';
import type { Logger } from 'winston';
import { createChildLogger } from '$lib/server/logger';
import { deleteExpiredPastes } from './cleanup-handler';

/**
 * Manages automatic paste cleanup scheduling using cron expressions.
 * Implemented as a singleton to ensure only one instance runs.
 */
export class PasteCleanupScheduler {
	private static instance: PasteCleanupScheduler | null = null;
	private cleanupJob: Cron | null = null;
	private readonly logger: Logger;

	private constructor() {
		this.logger = createChildLogger('PasteCleanupScheduler');
		// private constructor for singleton pattern
	}

	/**
	 * Get the singleton instance of PasteCleanupScheduler.
	 */
	public static getInstance(): PasteCleanupScheduler {
		if (!PasteCleanupScheduler.instance) {
			PasteCleanupScheduler.instance = new PasteCleanupScheduler();
		}
		return PasteCleanupScheduler.instance;
	}

	/**
	 * Starts the paste cleanup scheduler based on settings from the database.
	 */
	public async start(): Promise<void> {
		if (this.cleanupJob) {
			this.logger.warn('Paste cleanup scheduler is already running.');
			return;
		}

		try {
			// cleanup pastes every 10 minutes
			const cronPattern = '*/10 * * * *';
			this.logger.info(`Starting paste cleanup scheduler to run every 10 minutes`);

			// validate cron pattern before creating the job
			try {
				// create a test cron to validate the pattern
				const testCron = new Cron(cronPattern, () => {});
				testCron.stop();
			} catch (error) {
				throw new Error(`Invalid cron pattern "${cronPattern}": ${error}`);
			}

			this.cleanupJob = new Cron(cronPattern, async () => {
				this.logger.info('Triggering scheduled paste cleanup...');
				await this.triggerCleanup();
			});

			this.logger.info('Paste cleanup scheduler started successfully');
		} catch (error) {
			this.logger.error(`Failed to start paste cleanup scheduler: ${error}`);
			throw error;
		}
	}

	/**
	 * Stops the paste cleanup scheduler.
	 */
	public stop(): void {
		if (this.cleanupJob) {
			this.cleanupJob.stop();
			this.cleanupJob = null;
			this.logger.info('Paste cleanup scheduler stopped.');
		} else {
			this.logger.info('Paste cleanup scheduler was not running.');
		}
	}

	/**
	 * Restarts the paste cleanup scheduler with updated settings
	 */
	public async restart(): Promise<void> {
		this.logger.info('Restarting paste cleanup scheduler...');
		this.stop();
		await this.start();
	}

	/**
	 * Gets the current status of the paste cleanup scheduler
	 */
	public getStatus(): {
		isRunning: boolean;
		nextRun: Date | null;
		cronPattern: string | null;
	} {
		if (!this.cleanupJob) {
			return {
				isRunning: false,
				nextRun: null,
				cronPattern: null,
			};
		}

		return {
			isRunning: true,
			nextRun: this.cleanupJob.nextRun(),
			cronPattern: this.cleanupJob.getPattern() || null,
		};
	}

	/**
	 * Manually trigger paste cleanup (for testing/admin purposes)
	 */
	public async triggerCleanup(): Promise<{ deletedCount: number; errors: string[] }> {
		this.logger.info('Triggering paste cleanup...');
		const startTime = Date.now();

		try {
			const result = await deleteExpiredPastes();
			const duration = Date.now() - startTime;
			if (result.deletedCount > 0) {
				this.logger.info(
					`Paste cleanup completed successfully in ${duration}ms - deleted ${result.deletedCount} pastes`
				);
			} else {
				this.logger.info(`Paste cleanup completed - no expired pastes found`);
			}

			if (result.errors.length > 0) {
				this.logger.warn(
					`Paste cleanup completed with ${result.errors.length} errors:`,
					result.errors
				);
			}
			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			this.logger.error(`Paste cleanup failed after ${duration}ms:`, error);
			throw error;
		}
	}
}
