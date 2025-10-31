import { env } from '$env/dynamic/private';
import { S3Client } from 'bun';
import fs from 'fs-extra';
import path from 'path';
import { createChildLogger } from '$lib/server/logger';
import {
	MULTIPART_THRESHOLD,
	checkRequiredEnvVars,
	createSanitizedKey,
	formatFileSize,
	getContentType,
	validateBackupFile,
} from './upload-helpers';

const logger = createChildLogger('S3Uploader');

/**
 * Checks if S3 upload is configured by verifying required environment variables
 * @returns Boolean indicating if S3 upload is available
 */
export const isS3UploadConfigured = (): boolean => {
	const requiredEnvVars = [
		'AWS_ACCESS_KEY_ID',
		'AWS_SECRET_ACCESS_KEY',
		'AWS_REGION',
		'AWS_S3_BUCKET',
	];

	const { isConfigured, missingVars } = checkRequiredEnvVars(requiredEnvVars, env);

	if (!isConfigured) {
		logger.debug(
			`S3 upload not configured - missing environment variables: ${missingVars.join(', ')}`
		);
	}

	return isConfigured;
};

/**
 * Creates and configures a Bun S3 client using environment variables
 * @returns Configured S3Client instance
 * @throws Error if required credentials are missing
 */
export const createS3Client = (): S3Client => {
	if (!isS3UploadConfigured()) {
		throw new Error(
			'S3 upload is not properly configured - missing required environment variables'
		);
	}

	return new S3Client({
		accessKeyId: env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
		region: env.AWS_REGION!,
		bucket: env.AWS_S3_BUCKET!,
	});
};

/**
 * Uploads a backup file to AWS S3 using Bun's native S3 client
 * @param filePath - Full path to the backup file to upload
 * @returns Promise that resolves when upload is complete
 * @throws Error if upload fails or S3 is not configured
 */
export const uploadBackupToS3 = async (filePath: string): Promise<void> => {
	if (!isS3UploadConfigured()) {
		throw new Error('S3 upload is not configured - skipping upload');
	}

	logger.info(`Starting S3 upload for backup: ${filePath}`);

	try {
		const fileStats = await validateBackupFile(filePath);

		// create sanitized S3 key
		const fileName = path.basename(filePath);
		const keyPrefix = env.AWS_S3_KEY_PREFIX || '';
		const s3Key = createSanitizedKey(keyPrefix, fileName);

		const contentType = getContentType(filePath);

		const s3Client = createS3Client();
		const s3File = s3Client.file(s3Key);

		logger.info(
			`Uploading to S3: s3://${env.AWS_S3_BUCKET}/${s3Key} (${formatFileSize(fileStats.size)}, ${contentType})`
		);

		// use streaming upload for memory efficiency and large file support
		if (fileStats.size > MULTIPART_THRESHOLD) {
			logger.info(`Using multipart upload for large file (${formatFileSize(fileStats.size)})`);

			// create a readable stream from the file
			const fileStream = fs.createReadStream(filePath);

			// use bun S3 writer for multipart upload
			const writer = s3File.writer({
				type: contentType,
				retry: 3, // retry failed parts up to 3 times
				queueSize: 4, // upload 4 parts concurrently
				partSize: 5 * 1024 * 1024, // 5mb per part (minimum allowed)
			});

			let uploadedBytes = 0;

			// pipe the file stream to S3
			for await (const chunk of fileStream) {
				writer.write(chunk);
				uploadedBytes += chunk.length;

				// log progress
				const percent = ((uploadedBytes / fileStats.size) * 100).toFixed(1);
				logger.debug(`Upload progress: ${percent}% (${formatFileSize(uploadedBytes)})`);
			}

			await writer.end();
		} else {
			// use simple upload for smaller files
			logger.debug('Using simple upload for small file');

			const fileBuffer = await fs.readFile(filePath);
			await s3File.write(fileBuffer, {
				type: contentType,
			});
		}

		logger.info(`Successfully uploaded backup to S3: ${s3Key}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		logger.error(`Failed to upload backup to S3: ${errorMessage}`, error);
		throw new Error(`S3 upload failed: ${errorMessage}`);
	}
};

/**
 * Validates S3 configuration and tests connectivity
 * @returns Promise that resolves with validation result
 */
export const validateS3Configuration = async (): Promise<{ valid: boolean; error?: string }> => {
	try {
		if (!isS3UploadConfigured()) {
			return { valid: false, error: 'Required S3 environment variables are not set' };
		}

		// create client to verify configuration
		const _s3Client = createS3Client();

		// test connectivity by attempting to list objects (limit to 1)
		// this will fail fast if credentials are invalid
		try {
			await S3Client.list(
				{ maxKeys: 1 },
				{
					accessKeyId: env.AWS_ACCESS_KEY_ID!,
					secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
					region: env.AWS_REGION!,
					bucket: env.AWS_S3_BUCKET!,
				}
			);
		} catch (error) {
			// if it is an S3 error, credentials are working but might be a permissions issue
			if (error && typeof error === 'object' && 'name' in error && error.name === 'S3Error') {
				logger.warn('S3 credentials appear valid but list operation failed (possibly permissions)');
			} else {
				throw error;
			}
		}

		logger.info('S3 configuration appears valid');

		return { valid: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		logger.error(`S3 configuration validation failed: ${errorMessage}`);
		return { valid: false, error: errorMessage };
	}
};
