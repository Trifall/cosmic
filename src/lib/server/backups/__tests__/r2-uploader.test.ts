import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createR2Client, isR2UploadConfigured } from '../r2-uploader';

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

// mock environment variables
vi.mock('$env/dynamic/private', () => ({
	env: {},
}));

describe('R2 Uploader Security Tests', () => {
	let mockEnv: Record<string, string | undefined>;

	beforeEach(async () => {
		// get the mocked env object
		const { env } = await import('$env/dynamic/private');
		mockEnv = env as Record<string, string | undefined>;

		// reset env before each test
		Object.keys(mockEnv).forEach((key) => delete mockEnv[key]);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('R2_ACCOUNT_ID Validation (SSRF Prevention)', () => {
		beforeEach(() => {
			// set up valid credentials for all tests
			mockEnv.R2_ACCESS_KEY_ID = 'test-access-key';
			mockEnv.R2_SECRET_ACCESS_KEY = 'test-secret-key';
			mockEnv.R2_BUCKET_NAME = 'test-bucket';
		});

		it('should accept valid 32-character lowercase hex account ID', () => {
			mockEnv.R2_ACCOUNT_ID = 'a1b2c3d4e5f6789012345678901234ab'; // 32 lowercase hex chars

			expect(() => createR2Client()).not.toThrow();
		});

		it('should reject account ID with uppercase characters', () => {
			mockEnv.R2_ACCOUNT_ID = 'A1B2C3D4E5F6789012345678901234AB'; // uppercase

			expect(() => createR2Client()).toThrow(/Invalid R2_ACCOUNT_ID format/);
			expect(() => createR2Client()).toThrow(/lowercase hexadecimal/);
		});

		it('should reject account ID that is too short', () => {
			mockEnv.R2_ACCOUNT_ID = 'a1b2c3d4e5f6789012345678901234a'; // 31 chars

			expect(() => createR2Client()).toThrow(/Invalid R2_ACCOUNT_ID format/);
			expect(() => createR2Client()).toThrow(/exactly 32 characters/);
		});

		it('should reject account ID that is too long', () => {
			mockEnv.R2_ACCOUNT_ID = 'a1b2c3d4e5f6789012345678901234abc'; // 33 chars

			expect(() => createR2Client()).toThrow(/Invalid R2_ACCOUNT_ID format/);
			expect(() => createR2Client()).toThrow(/exactly 32 characters/);
		});

		it('should reject account ID with invalid characters', () => {
			// non-hex characters
			mockEnv.R2_ACCOUNT_ID = 'g1h2i3j4k5l6789012345678901234mn'; // contains g,h,i,j,k,l,m,n

			expect(() => createR2Client()).toThrow(/Invalid R2_ACCOUNT_ID format/);
			expect(() => createR2Client()).toThrow(/lowercase hexadecimal/);
		});

		it('should reject account ID with special characters (SSRF attempt)', () => {
			mockEnv.R2_ACCOUNT_ID = 'evil.com@attacker.com/path12345'; // domain injection attempt

			expect(() => createR2Client()).toThrow(/Invalid R2_ACCOUNT_ID format/);
		});

		it('should reject account ID with URL schemes (SSRF attempt)', () => {
			mockEnv.R2_ACCOUNT_ID = 'https://attacker.com/12345678'; // URL scheme

			expect(() => createR2Client()).toThrow(/Invalid R2_ACCOUNT_ID format/);
		});

		it('should reject account ID with path traversal (SSRF attempt)', () => {
			mockEnv.R2_ACCOUNT_ID = '../../../etc/passwd/1234567890'; // path traversal

			expect(() => createR2Client()).toThrow(/Invalid R2_ACCOUNT_ID format/);
		});

		it('should reject account ID with null bytes', () => {
			mockEnv.R2_ACCOUNT_ID = 'a1b2c3d4e5f6789012345678901234\x00ab'; // null byte

			expect(() => createR2Client()).toThrow(/Invalid R2_ACCOUNT_ID format/);
		});

		it('should reject account ID with spaces', () => {
			mockEnv.R2_ACCOUNT_ID = 'a1b2c3d4 e5f6789012345678901234ab'; // contains space

			expect(() => createR2Client()).toThrow(/Invalid R2_ACCOUNT_ID format/);
		});

		it('should reject account ID with hyphens', () => {
			mockEnv.R2_ACCOUNT_ID = 'a1b2c3d4-e5f6-7890-1234-5678901234ab'; // contains hyphens

			expect(() => createR2Client()).toThrow(/Invalid R2_ACCOUNT_ID format/);
		});

		it('should reject empty account ID', () => {
			mockEnv.R2_ACCOUNT_ID = '';

			expect(() => createR2Client()).toThrow(/R2 upload is not properly configured/);
		});

		it('should reject undefined account ID', () => {
			delete mockEnv.R2_ACCOUNT_ID;

			expect(() => createR2Client()).toThrow(/R2 upload is not properly configured/);
		});
	});

	describe('isR2UploadConfigured', () => {
		it('should return true when all required env vars are set', () => {
			mockEnv.R2_ACCESS_KEY_ID = 'test-key';
			mockEnv.R2_SECRET_ACCESS_KEY = 'test-secret';
			mockEnv.R2_ACCOUNT_ID = 'a1b2c3d4e5f6789012345678901234ab';
			mockEnv.R2_BUCKET_NAME = 'test-bucket';

			expect(isR2UploadConfigured()).toBe(true);
		});

		it('should return false when R2_ACCESS_KEY_ID is missing', () => {
			mockEnv.R2_SECRET_ACCESS_KEY = 'test-secret';
			mockEnv.R2_ACCOUNT_ID = 'a1b2c3d4e5f6789012345678901234ab';
			mockEnv.R2_BUCKET_NAME = 'test-bucket';

			expect(isR2UploadConfigured()).toBe(false);
		});

		it('should return false when R2_SECRET_ACCESS_KEY is missing', () => {
			mockEnv.R2_ACCESS_KEY_ID = 'test-key';
			mockEnv.R2_ACCOUNT_ID = 'a1b2c3d4e5f6789012345678901234ab';
			mockEnv.R2_BUCKET_NAME = 'test-bucket';

			expect(isR2UploadConfigured()).toBe(false);
		});

		it('should return false when R2_ACCOUNT_ID is missing', () => {
			mockEnv.R2_ACCESS_KEY_ID = 'test-key';
			mockEnv.R2_SECRET_ACCESS_KEY = 'test-secret';
			mockEnv.R2_BUCKET_NAME = 'test-bucket';

			expect(isR2UploadConfigured()).toBe(false);
		});

		it('should return false when R2_BUCKET_NAME is missing', () => {
			mockEnv.R2_ACCESS_KEY_ID = 'test-key';
			mockEnv.R2_SECRET_ACCESS_KEY = 'test-secret';
			mockEnv.R2_ACCOUNT_ID = 'a1b2c3d4e5f6789012345678901234ab';

			expect(isR2UploadConfigured()).toBe(false);
		});

		it('should return false when all env vars are missing', () => {
			expect(isR2UploadConfigured()).toBe(false);
		});
	});
});
