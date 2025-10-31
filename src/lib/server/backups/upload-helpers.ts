import fs from 'fs-extra';
import { lookup as getMimeType } from 'mime-types';
import path from 'path';
import { sanitizeFilename } from '$src/lib/utils/format';

// AWS S3/R2 key length limit (1024 bytes for UTF-8 encoded keys)
export const MAX_S3_R2_KEY_LENGTH = 1024;

// file size threshold for using multipart upload (5MB)
export const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

/**
 * Sanitizes and validates S3-compatible key components
 * @param keyPrefix - The prefix to sanitize
 * @param fileName - The filename to sanitize
 * @returns Sanitized key
 * @throws Error if key is invalid or too long
 */
export const createSanitizedKey = (keyPrefix: string, fileName: string): string => {
	// sanitize prefix: remove leading/trailing slashes and invalid characters
	const sanitizedPrefix = keyPrefix
		.replace(/\.\./g, '') // remove directory traversal sequences
		.replace(/^\.\//, '') // remove leading ./ (current directory)
		.replace(/^\/+|\/+$/g, '') // remove leading/trailing slashes
		.replace(/[^\w\-_.\/]/g, '_') // replace invalid chars with underscore
		.replace(/\/+/g, '/'); // collapse multiple slashes

	const sanitizedFileName = sanitizeFilename(fileName);

	if (!sanitizedFileName) {
		throw new Error('Invalid filename - results in empty string after sanitization');
	}

	// construct final key
	const key = sanitizedPrefix ? `${sanitizedPrefix}/${sanitizedFileName}` : sanitizedFileName;

	// validate key length
	if (Buffer.byteLength(key, 'utf8') > MAX_S3_R2_KEY_LENGTH) {
		throw new Error(
			`Key too long (${Buffer.byteLength(key, 'utf8')} bytes, max ${MAX_S3_R2_KEY_LENGTH}): ${key}`
		);
	}

	return key;
};

/**
 * Determines appropriate content type for a file
 * @param filePath - Path to the file
 * @returns MIME type string
 */
export const getContentType = (filePath: string): string => {
	const mimeType = getMimeType(filePath);

	if (mimeType) {
		return mimeType;
	}

	// fallback for common backup file types
	const ext = path.extname(filePath).toLowerCase();
	switch (ext) {
		case '.sql':
			return 'application/sql';
		case '.dump':
			return 'application/octet-stream';
		case '.tar':
			return 'application/x-tar';
		case '.gz':
			return 'application/gzip';
		case '.tar.gz':
		case '.tgz':
			return 'application/gzip';
		default:
			return 'application/octet-stream';
	}
};

/**
 * Validates that a file exists and is not empty
 * @param filePath - Path to the file to validate
 * @returns File stats
 * @throws Error if file doesn't exist, is not a file, or is empty
 */
export const validateBackupFile = async (filePath: string): Promise<fs.Stats> => {
	const fileStats = await fs.stat(filePath);

	if (!fileStats.isFile()) {
		throw new Error(`Backup path is not a file: ${filePath}`);
	}

	if (fileStats.size === 0) {
		throw new Error(`Backup file is empty: ${filePath}`);
	}

	return fileStats;
};

/**
 * Formats file size for logging
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "15.23 MB")
 */
export const formatFileSize = (bytes: number): string => {
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

/**
 * Checks if required environment variables are set
 * @param envVars - Array of environment variable names to check
 * @param env - Environment object
 * @returns Object with isConfigured flag and array of missing variables
 */
export const checkRequiredEnvVars = (
	envVars: string[],
	env: Record<string, string | undefined>
): { isConfigured: boolean; missingVars: string[] } => {
	const missingVars = envVars.filter((varName) => !env[varName]);

	return {
		isConfigured: missingVars.length === 0,
		missingVars,
	};
};
