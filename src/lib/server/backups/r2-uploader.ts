import { env } from '$env/dynamic/private';
import { S3Client } from 'bun';
import fs from 'fs-extra';
import path from 'path';
import * as z from 'zod';
import { createChildLogger } from '$lib/server/logger';
import {
	MULTIPART_THRESHOLD,
	checkRequiredEnvVars,
	createSanitizedKey,
	formatFileSize,
	getContentType,
	validateBackupFile,
} from './upload-helpers';

const logger = createChildLogger('R2Uploader');

/**
 * Checks if R2 upload is configured by verifying required environment variables
 * @returns boolean indicating if R2 upload is available
 */
export const isR2UploadConfigured = (): boolean => {
	const requiredEnvVars = [
		'R2_ACCESS_KEY_ID',
		'R2_SECRET_ACCESS_KEY',
		'R2_ACCOUNT_ID',
		'R2_BUCKET_NAME',
	];

	const { isConfigured, missingVars } = checkRequiredEnvVars(requiredEnvVars, env);

	if (!isConfigured) {
		logger.debug(
			`R2 upload not configured - missing environment variables: ${missingVars.join(', ')}`
		);
	}

	return isConfigured;
};

/**
 * Cloudflare R2 account ID schema - validates 32 hexadecimal character format
 * Prevents SSRF attacks by ensuring account ID cannot contain malicious hostnames
 */
const R2AccountIdSchema = z
	.string()
	.length(32, 'R2_ACCOUNT_ID must be exactly 32 characters')
	.regex(/^[a-f0-9]{32}$/, 'R2_ACCOUNT_ID must contain only lowercase hexadecimal characters');

/**
 * Creates and configures a Bun S3 client for R2 using environment variables
 * @returns Configured S3Client instance for R2
 * @throws Error if required credentials are missing or R2_ACCOUNT_ID format is invalid
 */
export const createR2Client = (): S3Client => {
	if (!isR2UploadConfigured()) {
		throw new Error(
			'R2 upload is not properly configured - missing required environment variables'
		);
	}

	// validate r2 account id format to prevent ssrf attacks
	const accountIdValidation = R2AccountIdSchema.safeParse(env.R2_ACCOUNT_ID);
	if (!accountIdValidation.success) {
		throw new Error(
			`Invalid R2_ACCOUNT_ID format. Expected 32 lowercase hexadecimal characters. ${accountIdValidation.error.message}`
		);
	}

	const validatedAccountId = accountIdValidation.data;

	// cloudflare r2 endpoint format: https://<account-id>.r2.cloudflarestorage.com
	const endpoint = `https://${validatedAccountId}.r2.cloudflarestorage.com`;

	return new S3Client({
		accessKeyId: env.R2_ACCESS_KEY_ID!,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
		bucket: env.R2_BUCKET_NAME!,
		endpoint,
	});
};

/**
 * Uploads a backup file to Cloudflare R2 using Bun's native S3 client
 * @param filePath - Full path to the backup file to upload
 * @returns Promise that resolves when upload is complete
 * @throws Error if upload fails or R2 is not configured
 */
export const uploadBackupToR2 = async (filePath: string): Promise<void> => {
	if (!isR2UploadConfigured()) {
		throw new Error('R2 upload is not configured - skipping upload');
	}

	logger.info(`Starting R2 upload for backup: ${filePath}`);

	try {
		const fileStats = await validateBackupFile(filePath);

		// create sanitized r2 key
		const fileName = path.basename(filePath);
		const keyPrefix = env.R2_KEY_PREFIX || '';
		const r2Key = createSanitizedKey(keyPrefix, fileName);

		const contentType = getContentType(filePath);

		const r2Client = createR2Client();
		const r2File = r2Client.file(r2Key);

		logger.info(
			`Uploading to R2: r2://${env.R2_BUCKET_NAME}/${r2Key} (${formatFileSize(fileStats.size)}, ${contentType})`
		);

		// use streaming upload for memory efficiency and large file support
		if (fileStats.size > MULTIPART_THRESHOLD) {
			logger.info(`Using multipart upload for large file (${formatFileSize(fileStats.size)})`);

			// create a readable stream from the file
			const fileStream = fs.createReadStream(filePath);

			// use bun s3 writer for multipart upload
			const writer = r2File.writer({
				type: contentType,
				retry: 3, // retry failed parts up to 3 times
				queueSize: 4, // upload 4 parts concurrently
				partSize: 5 * 1024 * 1024, // 5mb per part (minimum allowed)
			});

			let uploadedBytes = 0;

			// pipe the file stream to r2
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
			await r2File.write(fileBuffer, {
				type: contentType,
			});
		}

		logger.info(`Successfully uploaded backup to R2: ${r2Key}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		logger.error(`Failed to upload backup to R2: ${errorMessage}`, error);
		throw new Error(`R2 upload failed: ${errorMessage}`);
	}
};

/**
 * Validates R2 configuration and tests connectivity
 * @returns Promise that resolves with validation result
 */
export const validateR2Configuration = async (): Promise<{ valid: boolean; error?: string }> => {
	try {
		if (!isR2UploadConfigured()) {
			return { valid: false, error: 'Required R2 environment variables are not set' };
		}

		// create client to verify configuration
		const _r2Client = createR2Client();

		// validate account id format
		const accountIdValidation = R2AccountIdSchema.safeParse(env.R2_ACCOUNT_ID);
		if (!accountIdValidation.success) {
			return {
				valid: false,
				error: `Invalid R2_ACCOUNT_ID format: ${accountIdValidation.error.message}`,
			};
		}

		// test connectivity by attempting to list objects (limit to 1)
		// this will fail fast if credentials are invalid
		try {
			const validatedAccountId = accountIdValidation.data;
			const endpoint = `https://${validatedAccountId}.r2.cloudflarestorage.com`;

			await S3Client.list(
				{ maxKeys: 1 },
				{
					accessKeyId: env.R2_ACCESS_KEY_ID!,
					secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
					bucket: env.R2_BUCKET_NAME!,
					endpoint,
				}
			);
		} catch (error) {
			// if it is an s3 error, credentials are working but might be a permissions issue
			if (error && typeof error === 'object' && 'name' in error && error.name === 'S3Error') {
				logger.warn('R2 credentials appear valid but list operation failed (possibly permissions)');
			} else {
				throw error;
			}
		}

		logger.info('R2 configuration appears valid');

		return { valid: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		logger.error(`R2 configuration validation failed: ${errorMessage}`);
		return { valid: false, error: errorMessage };
	}
};
