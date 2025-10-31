import fs from 'fs-extra';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
	MAX_S3_R2_KEY_LENGTH,
	checkRequiredEnvVars,
	createSanitizedKey,
	formatFileSize,
	getContentType,
	validateBackupFile,
} from '../upload-helpers';

describe('Upload Helpers Security Tests', () => {
	describe('createSanitizedKey - Path Traversal Prevention', () => {
		it('should remove directory traversal sequences (..)', () => {
			// Single traversal
			expect(createSanitizedKey('../', 'backup.sql')).toBe('backup.sql');

			// Multiple traversals
			expect(createSanitizedKey('../../../', 'backup.sql')).toBe('backup.sql');

			// Mixed with valid path
			expect(createSanitizedKey('backups/../../../evil', 'backup.sql')).toBe(
				'backups/evil/backup.sql'
			);

			// Encoded traversal attempts (% gets replaced with _)
			expect(createSanitizedKey('backups/..%2F..%2F', 'backup.sql')).toBe(
				'backups/_2F_2F/backup.sql'
			);
		});

		it('should handle directory traversal in multiple positions', () => {
			expect(createSanitizedKey('../../prefix/../path', 'file.sql')).toBe('prefix/path/file.sql');

			expect(createSanitizedKey('../start/../middle/../end', 'backup.sql')).toBe(
				'start/middle/end/backup.sql'
			);
		});

		it('should preserve legitimate dots in filenames and paths', () => {
			// Dots in extensions and filenames should be preserved
			expect(createSanitizedKey('backups', 'file.backup.sql')).toBe('backups/file.backup.sql');

			// Single dots (current directory) should be allowed
			expect(createSanitizedKey('./backups', 'file.sql')).toBe('backups/file.sql');
		});

		it('should sanitize key prefix properly', () => {
			// Test leading/trailing slashes
			expect(createSanitizedKey('///backups///', 'test.sql')).toBe('backups/test.sql');

			// Test invalid characters
			expect(createSanitizedKey('back*ups#$%', 'test.sql')).toBe('back_ups___/test.sql');

			// Test empty prefix
			expect(createSanitizedKey('', 'test.sql')).toBe('test.sql');

			// Test multiple slashes collapsed
			expect(createSanitizedKey('backups///subfolder', 'test.sql')).toBe(
				'backups/subfolder/test.sql'
			);
		});

		it('should sanitize filename properly', () => {
			// Path separators in filename should be converted
			expect(createSanitizedKey('backups', '/path/to/file.sql')).toBe('backups/path_to_file.sql');

			// Invalid characters
			expect(createSanitizedKey('backups', 'test@#$%.sql')).toBe('backups/test_.sql');

			// Multiple consecutive underscores collapsed
			expect(createSanitizedKey('backups', 'test___file.sql')).toBe('backups/test_file.sql');
		});

		it('should throw error for empty filename after sanitization', () => {
			expect(() => createSanitizedKey('backups', '###')).toThrow(
				'Invalid filename - results in empty string after sanitization'
			);

			expect(() => createSanitizedKey('backups', '!!!')).toThrow(
				'Invalid filename - results in empty string after sanitization'
			);
		});

		it('should throw error for overly long keys', () => {
			const longPrefix = 'x'.repeat(500);
			const longFilename = 'y'.repeat(600) + '.sql';

			expect(() => createSanitizedKey(longPrefix, longFilename)).toThrow(/Key too long/);
			expect(() => createSanitizedKey(longPrefix, longFilename)).toThrow(
				new RegExp(`max ${MAX_S3_R2_KEY_LENGTH}`)
			);
		});

		it('should prevent null byte injection', () => {
			expect(createSanitizedKey('backups\x00evil', 'file.sql')).toBe('backups_evil/file.sql');

			expect(createSanitizedKey('backups', 'file\x00.sql')).toBe('backups/file_.sql');
		});

		it('should handle unicode and special characters safely', () => {
			// Unicode should be replaced with underscore (日本語 = 3 characters = ___)
			expect(createSanitizedKey('backups/日本語', 'file.sql')).toBe('backups/___/file.sql');

			// Emoji (surrogate pair = 2 UTF-16 code units = __)
			expect(createSanitizedKey('backups/🔥', 'file.sql')).toBe('backups/__/file.sql');
		});
	});

	describe('getContentType', () => {
		it('should detect SQL files correctly', () => {
			expect(getContentType('backup.sql')).toBe('application/sql');
			expect(getContentType('/path/to/backup.sql')).toBe('application/sql');
		});

		it('should detect ZIP files correctly', () => {
			expect(getContentType('backup.zip')).toBe('application/zip');
		});

		it('should detect dump files correctly', () => {
			expect(getContentType('backup.dump')).toBe('application/octet-stream');
		});

		it('should detect compressed files correctly', () => {
			expect(getContentType('backup.tar.gz')).toBe('application/gzip');
			expect(getContentType('backup.tgz')).toBe('application/gzip');
			expect(getContentType('backup.tar')).toBe('application/x-tar');
			expect(getContentType('backup.gz')).toBe('application/gzip');
		});

		it('should fallback to octet-stream for unknown extensions', () => {
			expect(getContentType('backup.unknown')).toBe('application/octet-stream');
			expect(getContentType('backup')).toBe('application/octet-stream');
		});

		it('should handle case-insensitive extensions', () => {
			expect(getContentType('backup.SQL')).toBe('application/sql');
			expect(getContentType('backup.TGZ')).toBe('application/gzip');
		});
	});

	describe('validateBackupFile', () => {
		it('should validate existing non-empty file', async () => {
			const tempFile = path.join(tmpdir(), 'test-backup.sql');
			await fs.writeFile(tempFile, 'SELECT * FROM users;');

			const stats = await validateBackupFile(tempFile);

			expect(stats.isFile()).toBe(true);
			expect(stats.size).toBeGreaterThan(0);

			await fs.remove(tempFile);
		});

		it('should throw error for non-existent file', async () => {
			await expect(validateBackupFile('/nonexistent/file.sql')).rejects.toThrow();
		});

		it('should throw error for directory', async () => {
			const tempDir = path.join(tmpdir(), 'test-backup-dir');
			await fs.ensureDir(tempDir);

			await expect(validateBackupFile(tempDir)).rejects.toThrow('Backup path is not a file');

			await fs.remove(tempDir);
		});

		it('should throw error for empty file', async () => {
			const tempFile = path.join(tmpdir(), 'empty-backup.sql');
			await fs.writeFile(tempFile, '');

			await expect(validateBackupFile(tempFile)).rejects.toThrow('Backup file is empty');

			await fs.remove(tempFile);
		});
	});

	describe('formatFileSize', () => {
		it('should format bytes to MB correctly', () => {
			expect(formatFileSize(0)).toBe('0.00 MB');
			expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
			expect(formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB');
			expect(formatFileSize(1536 * 1024)).toBe('1.50 MB'); // 1.5 MB
		});

		it('should handle very large files', () => {
			expect(formatFileSize(1024 * 1024 * 1024)).toBe('1024.00 MB'); // 1 GB
			expect(formatFileSize(10 * 1024 * 1024 * 1024)).toBe('10240.00 MB'); // 10 GB
		});

		it('should handle very small files', () => {
			expect(formatFileSize(1)).toBe('0.00 MB');
			expect(formatFileSize(1024)).toBe('0.00 MB');
		});
	});

	describe('checkRequiredEnvVars', () => {
		it('should return configured when all vars present', () => {
			const env = {
				VAR1: 'value1',
				VAR2: 'value2',
				VAR3: 'value3',
			};

			const result = checkRequiredEnvVars(['VAR1', 'VAR2', 'VAR3'], env);

			expect(result.isConfigured).toBe(true);
			expect(result.missingVars).toEqual([]);
		});

		it('should return missing vars when some absent', () => {
			const env = {
				VAR1: 'value1',
				VAR3: 'value3',
			};

			const result = checkRequiredEnvVars(['VAR1', 'VAR2', 'VAR3'], env);

			expect(result.isConfigured).toBe(false);
			expect(result.missingVars).toEqual(['VAR2']);
		});

		it('should return all missing when env empty', () => {
			const env = {};

			const result = checkRequiredEnvVars(['VAR1', 'VAR2', 'VAR3'], env);

			expect(result.isConfigured).toBe(false);
			expect(result.missingVars).toEqual(['VAR1', 'VAR2', 'VAR3']);
		});

		it('should treat undefined values as missing', () => {
			const env = {
				VAR1: 'value1',
				VAR2: undefined,
				VAR3: 'value3',
			};

			const result = checkRequiredEnvVars(['VAR1', 'VAR2', 'VAR3'], env);

			expect(result.isConfigured).toBe(false);
			expect(result.missingVars).toEqual(['VAR2']);
		});

		it('should treat empty strings as missing', () => {
			// Empty strings are falsy and should be treated as missing
			const env = {
				VAR1: '',
				VAR2: 'value2',
			};

			const result = checkRequiredEnvVars(['VAR1', 'VAR2'], env);

			expect(result.isConfigured).toBe(false);
			expect(result.missingVars).toEqual(['VAR1']);
		});
	});
});
