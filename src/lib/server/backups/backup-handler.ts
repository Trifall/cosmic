import { env } from '$env/dynamic/private';
import { logs } from '@/database/schema';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { zip } from 'zip-a-folder';
import { db } from '$lib/server/db';
import { createChildLogger } from '$lib/server/logger';
import { getSetting } from '$lib/server/settings';
import { getDatabaseEnvVars } from '$src/lib/server/env';
import { isR2UploadConfigured, uploadBackupToR2 } from './r2-uploader';
import { isS3UploadConfigured, uploadBackupToS3 } from './s3-uploader';

const logger = createChildLogger('BackupHandler');

/**
 * Performs a complete database backup including compression and cleanup
 * @throws Error if backup process fails
 */
export const performDatabaseBackup = async (): Promise<void> => {
	const filesystemEnabled = await getSetting('filesystemBackupEnabled');
	const s3Enabled = await getSetting('s3BackupEnabled');
	const r2Enabled = await getSetting('r2BackupEnabled');

	if (!filesystemEnabled && !s3Enabled && !r2Enabled) {
		logger.info(
			'All backup methods (filesystem, S3, and R2) are disabled via settings. No backup will be performed.'
		);
		throw new Error('All backup methods are disabled via settings.');
	}
	logger.info('Starting database backup process...');

	// check for BACKUPS_DIRECTORY env, otherwise use cwd
	const backupDir = env.BACKUPS_DIRECTORY || path.join(process.cwd(), 'backups');
	await fs.ensureDir(backupDir); // ensures the directory exists

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const backupSubfolder = `cosmic-db-backup-${timestamp}`;
	const backupPath = path.join(backupDir, backupSubfolder);
	await fs.ensureDir(backupPath);

	const dumpFileName = `cosmic_database_backup_${timestamp}.sql`;
	const dumpFilePath = path.join(backupPath, dumpFileName);

	try {
		// 2. extract database connection info from DATABASE_URL

		const { dbUser, dbName, dbPort, dbHost, dbPassword } = getDatabaseEnvVars();

		// 3. execute pg_dump with connection parameters
		const pgDumpArgs = [
			'--file',
			dumpFilePath,
			'--format=c', // use custom format for better compression and robustness
			'--host',
			dbHost,
			'--port',
			String(dbPort),
			'--username',
			dbUser,
			'--dbname',
			dbName,
			'--verbose',
		];

		logger.info(`Running pg_dump for database: ${dbName}`);

		// set password via environment variable for security
		const pgenv = { ...process.env, PGPASSWORD: dbPassword };

		// bun functions not available in vite dev mode
		const exitCode = await new Promise<number>((resolve, reject) => {
			const proc = spawn('pg_dump', pgDumpArgs, {
				env: pgenv,
				stdio: 'pipe', // capture output for better error handling
			});

			let stderr = '';
			proc.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			proc.on('close', (code) => {
				if (code !== 0) {
					logger.error(`pg_dump stderr: ${stderr}`);
				}
				resolve(code || 0);
			});

			proc.on('error', (error) => {
				reject(new Error(`Failed to start pg_dump: ${error.message}`));
			});
		});

		if (exitCode !== 0) {
			throw new Error(`pg_dump failed with exit code ${exitCode}`);
		}

		logger.info('Database dump completed successfully');

		// 4. check if file was created and has content
		const stats = await fs.stat(dumpFilePath);
		if (stats.size === 0) {
			throw new Error('Backup file is empty, database dump may have failed');
		}

		logger.info(
			`Backup file created: ${dumpFilePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
		);

		// 5. compress backup (if enabled)
		const autoZip = await getSetting('enableAutoZip');
		let finalBackupPath = dumpFilePath; // default to the dump file

		if (autoZip) {
			logger.info('Compressing backup...');
			const zipPath = `${backupPath}.zip`;
			await zip(backupPath, zipPath);

			// verify zip was created successfully
			const zipStats = await fs.stat(zipPath);
			logger.info(`Backup compressed: ${zipPath} (${(zipStats.size / 1024 / 1024).toFixed(2)} MB)`);

			// clean up original folder after successful compression
			await fs.remove(backupPath);
			logger.info('Original backup folder cleaned up after compression');

			finalBackupPath = zipPath; // use the zip file for S3/R2 upload
		}

		// 6. check backup settings and handle S3/R2 upload / local cleanup
		const filesystemBackupEnabled = await getSetting('filesystemBackupEnabled');
		const s3BackupEnabled = await getSetting('s3BackupEnabled');
		const r2BackupEnabled = await getSetting('r2BackupEnabled');

		// upload to S3 if enabled and configured
		let s3UploadSuccessful = false;
		if (s3BackupEnabled && isS3UploadConfigured()) {
			logger.info('S3 backup is enabled and configured - uploading backup...');
			try {
				await uploadBackupToS3(finalBackupPath);
				logger.info('Successfully uploaded backup to S3');
				s3UploadSuccessful = true;
			} catch (error) {
				// log error but dont fail the entire backup process
				logger.error(`Failed to upload backup to S3: ${error}`);
				s3UploadSuccessful = false;
			}
		} else if (s3BackupEnabled && !isS3UploadConfigured()) {
			logger.warn('S3 backup is enabled but not properly configured - skipping S3 upload');
		} else {
			logger.debug('S3 backup disabled - skipping upload');
		}

		// upload to R2 if enabled and configured
		let r2UploadSuccessful = false;
		if (r2BackupEnabled && isR2UploadConfigured()) {
			logger.info('R2 backup is enabled and configured - uploading backup...');
			try {
				await uploadBackupToR2(finalBackupPath);
				logger.info('Successfully uploaded backup to R2');
				r2UploadSuccessful = true;
			} catch (error) {
				// log error but dont fail the entire backup process
				logger.error(`Failed to upload backup to R2: ${error}`);
				r2UploadSuccessful = false;
			}
		} else if (r2BackupEnabled && !isR2UploadConfigured()) {
			logger.warn('R2 backup is enabled but not properly configured - skipping R2 upload');
		} else {
			logger.debug('R2 backup disabled - skipping upload');
		}

		const backupFileSize = await fs.stat(finalBackupPath).then((stats) => stats.size);

		// clean up local files if file system backup is disabled and all enabled cloud uploads were successful
		// determine if all enabled cloud backups succeeded
		const enabledCloudBackups = [];
		if (s3BackupEnabled && isS3UploadConfigured()) enabledCloudBackups.push(s3UploadSuccessful);
		if (r2BackupEnabled && isR2UploadConfigured()) enabledCloudBackups.push(r2UploadSuccessful);
		const allEnabledCloudUploadsSucceeded =
			enabledCloudBackups.length > 0 && enabledCloudBackups.every((success) => success);

		if (!filesystemBackupEnabled && allEnabledCloudUploadsSucceeded) {
			logger.info(
				'File system backup disabled and all enabled cloud uploads successful - cleaning up local backup files'
			);
			try {
				await fs.remove(finalBackupPath);
				logger.info(`Successfully deleted local backup file: ${finalBackupPath}`);
			} catch (error) {
				logger.error(`Failed to delete local backup file after cloud uploads: ${error}`);
			}
		} else if (!filesystemBackupEnabled && !allEnabledCloudUploadsSucceeded) {
			logger.warn(
				'File system backup disabled but not all enabled cloud uploads succeeded - keeping local backup file as fallback'
			);
		} else if (filesystemBackupEnabled) {
			logger.info('File system backup enabled - keeping local backup file');
		}

		// 7. cleanup old backups
		await cleanupOldBackups(backupDir);

		// 8. log successful backup to database
		try {
			await db.insert(logs).values({
				level: 'INFO',
				source: 'DatabaseBackup',
				message: 'Database backup completed successfully',
				details: {
					filename: path.basename(finalBackupPath),
					size: backupFileSize,
					compressed: autoZip,
					uploadedToS3: s3UploadSuccessful,
					uploadedToR2: r2UploadSuccessful,
					filesystemBackup: filesystemBackupEnabled,
				},
			});
		} catch (error) {
			logger.warn(`Failed to log backup to database: ${error}`);
			// dont throw - logging failure shouldnt prevent backup success
		}

		logger.info('Database backup process completed successfully');
	} catch (error) {
		logger.error(`Database backup failed: ${error}`);

		// if anything fails, clean up the temporary folder for this attempt
		try {
			if (await fs.pathExists(backupPath)) {
				await fs.remove(backupPath);
				logger.info(`Cleaned up failed backup attempt: ${backupPath}`);
			}
		} catch (cleanupError) {
			logger.error(`Failed to clean up backup folder: ${cleanupError}`);
		}

		throw error; // re-throw to be caught by the scheduler
	}
};

/**
 * Removes backup files older than the configured retention period
 * @param backupDir - Directory containing backup files
 */
export const cleanupOldBackups = async (backupDir: string): Promise<void> => {
	try {
		const retentionDays = await getSetting('backupRetentionDays');
		const files = await fs.readdir(backupDir);
		const cutoffDate = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

		logger.info(`Cleaning up backups older than ${retentionDays} days...`);

		let deletedCount = 0;
		for (const file of files) {
			const filePath = path.join(backupDir, file);

			try {
				const stat = await fs.stat(filePath);
				if (stat.mtime.getTime() < cutoffDate) {
					await fs.remove(filePath);
					logger.info(`Deleted old backup: ${file}`);
					deletedCount++;
				}
			} catch (error) {
				logger.warn(`Failed to process backup file ${file}: ${error}`);
			}
		}

		if (deletedCount > 0) {
			logger.info(`Cleanup completed: ${deletedCount} old backup(s) deleted`);
		} else {
			logger.info('No old backups found for cleanup');
		}
	} catch (error) {
		logger.error(`Failed to cleanup old backups: ${error}`);
		// dont throw - cleanup failure shouldnt prevent backup success
	}
};

/**
 * Manually trigger a backup (useful for testing or manual backups)
 * @returns Promise that resolves when backup is complete
 */
export const triggerManualBackup = async (): Promise<{ success: boolean; message: string }> => {
	try {
		await performDatabaseBackup();
		return {
			success: true,
			message: 'Manual backup completed successfully',
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error occurred';
		return {
			success: false,
			message: message,
		};
	}
};
