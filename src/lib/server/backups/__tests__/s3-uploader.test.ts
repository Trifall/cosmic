import { describe, expect, it, vi } from 'vitest';
import { createSanitizedKey, getContentType } from '../upload-helpers';

vi.mock('$env/dynamic/private', () => ({
	env: {
		AWS_ACCESS_KEY_ID: 'test-access-key',
		AWS_SECRET_ACCESS_KEY: 'test-secret-key',
		AWS_REGION: 'us-east-1',
		AWS_S3_BUCKET: 'test-bucket',
		AWS_S3_KEY_PREFIX: 'backups/',
	},
}));

// mock Buns S3Client
vi.mock('bun', () => ({
	S3Client: class MockS3Client {
		constructor() {}
		file() {
			return {
				write: vi.fn(),
				writer: vi.fn(),
			};
		}
		static list() {
			return Promise.resolve({ Contents: [] });
		}
	},
}));

vi.mock('$lib/server/logger', () => ({
	createChildLogger: vi.fn(() => ({
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
	})),
}));

describe('S3 Uploader Edge Cases', () => {
	describe('createSanitizedKey', () => {
		it('should sanitize key prefix properly', () => {
			// Test leading/trailing slashes
			expect(createSanitizedKey('///backups///', 'test.sql')).toBe('backups/test.sql');

			// Test invalid characters
			expect(createSanitizedKey('back*ups#$%', 'test.sql')).toBe('back_ups___/test.sql');

			// Test empty prefix
			expect(createSanitizedKey('', 'test.sql')).toBe('test.sql');
		});

		it('should sanitize filename properly', () => {
			// Test path separators
			expect(createSanitizedKey('backups', '/path/to/file.sql')).toBe('backups/path_to_file.sql');

			// Test invalid characters
			expect(createSanitizedKey('backups', 'test@#$%.sql')).toBe('backups/test_.sql');

			// Test multiple underscores
			expect(createSanitizedKey('backups', 'test___file.sql')).toBe('backups/test_file.sql');
		});

		it('should throw error for empty filename', () => {
			expect(() => createSanitizedKey('backups', '###')).toThrow(
				'Invalid filename - results in empty string after sanitization'
			);
		});

		it('should throw error for overly long keys', () => {
			const longPrefix = 'x'.repeat(500);
			const longFilename = 'y'.repeat(600) + '.sql';

			expect(() => createSanitizedKey(longPrefix, longFilename)).toThrow(/Key too long/);
		});
	});

	describe('getContentType', () => {
		it('should detect SQL files correctly', () => {
			expect(getContentType('backup.sql')).toBe('application/sql');
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
		});

		it('should fallback to octet-stream for unknown extensions', () => {
			expect(getContentType('backup.unknown')).toBe('application/octet-stream');
		});
	});
});
