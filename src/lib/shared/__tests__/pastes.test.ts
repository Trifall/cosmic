import { describe, expect, it } from 'vitest';
import {
	type CreatePasteData,
	CreatePasteSchema,
	type InvitedUser,
	PasteSlugSchema,
	PasteViewSchema,
	type SinglePasteData,
	SinglePasteDataSchema,
	type UpdatePasteData,
	UpdatePasteSchema,
	VISIBILITY_VALUES,
	type Visibility,
	VisibilitySchema,
	visibilityOptions,
} from '../pastes';

describe('pastes.ts', () => {
	describe('VISIBILITY_VALUES', () => {
		it('should contain all visibility options', () => {
			expect(VISIBILITY_VALUES).toEqual(['PUBLIC', 'AUTHENTICATED', 'INVITE_ONLY', 'PRIVATE']);
		});

		it('should be readonly', () => {
			expect(VISIBILITY_VALUES.length).toBe(4);
		});
	});

	describe('VisibilitySchema', () => {
		it('should validate all visibility values', () => {
			VISIBILITY_VALUES.forEach((value) => {
				expect(() => VisibilitySchema.parse(value)).not.toThrow();
			});
		});

		it('should reject invalid visibility values', () => {
			const invalid = ['public', 'INVALID', '', 'private', 123];
			invalid.forEach((value) => {
				expect(() => VisibilitySchema.parse(value)).toThrow();
			});
		});
	});

	describe('visibilityOptions', () => {
		it('should contain all visibility values with labels and descriptions', () => {
			expect(visibilityOptions.length).toBe(4);

			visibilityOptions.forEach((option) => {
				expect(option).toHaveProperty('value');
				expect(option).toHaveProperty('label');
				expect(option).toHaveProperty('description');
				expect(VISIBILITY_VALUES).toContain(option.value);
			});
		});

		it('should have correct structure for PUBLIC visibility', () => {
			const publicOption = visibilityOptions.find((o) => o.value === 'PUBLIC');
			expect(publicOption).toBeDefined();
			expect(publicOption?.label).toBe('Public');
			expect(publicOption?.description).toBe('Anyone with the link can view');
		});

		it('should have correct structure for PRIVATE visibility', () => {
			const privateOption = visibilityOptions.find((o) => o.value === 'PRIVATE');
			expect(privateOption).toBeDefined();
			expect(privateOption?.label).toBe('Private');
			expect(privateOption?.description).toBe('Only you can view');
		});
	});

	describe('PasteSlugSchema', () => {
		it('should accept valid slugs', () => {
			const validSlugs = [
				'my-paste',
				'test_slug',
				'paste123',
				'UPPERCASE',
				'Mix3d-Case_123',
				'a',
				'a'.repeat(100), // max length
			];

			validSlugs.forEach((slug) => {
				expect(() => PasteSlugSchema.parse(slug)).not.toThrow();
			});
		});

		it('should not accept undefined (optional)', () => {
			expect(() => PasteSlugSchema.parse(undefined)).toThrow();
		});

		it('should reject slugs that are too long', () => {
			const tooLong = 'a'.repeat(101);
			expect(() => PasteSlugSchema.parse(tooLong)).toThrow();
		});

		it('should reject slugs with invalid characters', () => {
			const invalidSlugs = [
				'my paste', // space
				'test@slug', // special char
				'slug/path', // slash
				'slug.txt', // dot
				'slug!', // exclamation
				'<script>', // html
			];

			invalidSlugs.forEach((slug) => {
				expect(() => PasteSlugSchema.parse(slug)).toThrow();
			});
		});

		it('should reject reserved route names', () => {
			const reservedRoutes = [
				'admin',
				'api',
				'auth',
				'login',
				'register',
				'raw',
				'edit',
				'delete',
				'new',
				'create',
			];

			reservedRoutes.forEach((slug) => {
				expect(() => PasteSlugSchema.parse(slug)).toThrow(
					'This URL is reserved and cannot be used'
				);
			});
		});

		it('should reject reserved routes case-insensitively', () => {
			const variants = ['ADMIN', 'Admin', 'aDmIn', 'API', 'Api'];

			variants.forEach((slug) => {
				expect(() => PasteSlugSchema.parse(slug)).toThrow(
					'This URL is reserved and cannot be used'
				);
			});
		});

		it('should reject empty strings', () => {
			expect(() => PasteSlugSchema.parse('')).toThrow();
		});
	});

	describe('CreatePasteSchema', () => {
		const validPasteBase = {
			content: 'console.log("Hello World");',
			visibility: 'PUBLIC' as Visibility,
			language: 'javascript' as const,
			title: 'My Test Paste',
		};

		describe('content validation', () => {
			it('should accept valid content', () => {
				const result = CreatePasteSchema.parse(validPasteBase);
				expect(result.content).toBe(validPasteBase.content);
			});

			it('should reject empty content', () => {
				const invalid = { ...validPasteBase, content: '' };
				expect(() => CreatePasteSchema.parse(invalid)).toThrow('Content cannot be empty');
			});

			it('should reject content over 400KB', () => {
				const largeContent = 'a'.repeat(400001);
				const invalid = { ...validPasteBase, content: largeContent };
				expect(() => CreatePasteSchema.parse(invalid)).toThrow();
			});
		});

		describe('visibility and invited users', () => {
			it('should accept INVITE_ONLY with invited users', () => {
				const data = {
					...validPasteBase,
					visibility: 'INVITE_ONLY' as Visibility,
					invitedUsers: ['user1', 'user2'],
				};
				expect(() => CreatePasteSchema.parse(data)).not.toThrow();
			});

			it('should reject INVITE_ONLY without invited users', () => {
				const data = {
					...validPasteBase,
					visibility: 'INVITE_ONLY' as Visibility,
				};
				expect(() => CreatePasteSchema.parse(data)).toThrow(
					'Invited users are required for INVITE_ONLY visibility'
				);
			});

			it('should reject INVITE_ONLY with empty invited users array', () => {
				const data = {
					...validPasteBase,
					visibility: 'INVITE_ONLY' as Visibility,
					invitedUsers: [],
				};
				expect(() => CreatePasteSchema.parse(data)).toThrow(
					'Invited users are required for INVITE_ONLY visibility'
				);
			});

			it('should reject invited users for non-INVITE_ONLY visibility', () => {
				const data = {
					...validPasteBase,
					visibility: 'PUBLIC' as Visibility,
					invitedUsers: ['user1'],
				};
				expect(() => CreatePasteSchema.parse(data)).toThrow(
					'Invited users should only be specified for INVITE_ONLY visibility'
				);
			});
		});

		describe('versioning validation', () => {
			it('should accept versionHistoryVisible when versioning is enabled', () => {
				const data = {
					...validPasteBase,
					versioningEnabled: true,
					versionHistoryVisible: true,
				};
				expect(() => CreatePasteSchema.parse(data)).not.toThrow();
			});

			it('should reject versionHistoryVisible when versioning is disabled', () => {
				const data = {
					...validPasteBase,
					versioningEnabled: false,
					versionHistoryVisible: true,
				};
				expect(() => CreatePasteSchema.parse(data)).toThrow(
					'Version history visibility can only be enabled when versioning is enabled'
				);
			});

			it('should reject versionHistoryVisible when versioning is not specified', () => {
				const data = {
					...validPasteBase,
					versionHistoryVisible: true,
				};
				expect(() => CreatePasteSchema.parse(data)).toThrow(
					'Version history visibility can only be enabled when versioning is enabled'
				);
			});
		});

		describe('expiry date validation', () => {
			it('should accept future expiry dates', () => {
				const futureDate = new Date();
				futureDate.setDate(futureDate.getDate() + 7);

				const data = {
					...validPasteBase,
					expiresAt: futureDate,
				};
				expect(() => CreatePasteSchema.parse(data)).not.toThrow();
			});

			it('should accept null expiry date', () => {
				const data = {
					...validPasteBase,
					expiresAt: null,
				};
				expect(() => CreatePasteSchema.parse(data)).not.toThrow();
			});

			it('should accept undefined expiry date', () => {
				const data = {
					...validPasteBase,
					expiresAt: undefined,
				};
				expect(() => CreatePasteSchema.parse(data)).not.toThrow();
			});

			it('should reject past expiry dates', () => {
				const pastDate = new Date();
				pastDate.setDate(pastDate.getDate() - 1);

				const data = {
					...validPasteBase,
					expiresAt: pastDate,
				};
				expect(() => CreatePasteSchema.parse(data)).toThrow('Expiry date must be in the future');
			});
		});

		describe('optional fields', () => {
			it('should accept minimal paste with defaults', () => {
				const minimal = {
					content: 'Test content',
				};
				const result = CreatePasteSchema.parse(minimal);
				expect(result.content).toBe('Test content');
				expect(result.visibility).toBe('PUBLIC');
				expect(result.language).toBe('plaintext');
				expect(result.burnAfterReading).toBe(false);
			});

			it('should accept custom slug', () => {
				const data = {
					...validPasteBase,
					customSlug: 'my-custom-slug',
				};
				const result = CreatePasteSchema.parse(data);
				expect(result.customSlug).toBe('my-custom-slug');
			});

			it('should accept password', () => {
				const data = {
					...validPasteBase,
					password: 'secret123',
				};
				const result = CreatePasteSchema.parse(data);
				expect(result.password).toBe('secret123');
			});

			it('should reject password over 100 characters', () => {
				const data = {
					...validPasteBase,
					password: 'a'.repeat(101),
				};
				expect(() => CreatePasteSchema.parse(data)).toThrow();
			});

			it('should reject title over 255 characters', () => {
				const data = {
					...validPasteBase,
					title: 'a'.repeat(256),
				};
				expect(() => CreatePasteSchema.parse(data)).toThrow();
			});

			it('should accept burnAfterReading', () => {
				const data = {
					...validPasteBase,
					burnAfterReading: true,
				};
				const result = CreatePasteSchema.parse(data);
				expect(result.burnAfterReading).toBe(true);
			});
		});
	});

	describe('UpdatePasteSchema', () => {
		describe('partial updates', () => {
			it('should accept empty object (no updates)', () => {
				expect(() => UpdatePasteSchema.parse({})).not.toThrow();
			});

			it('should accept partial content update', () => {
				const data = {
					content: 'Updated content',
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});

			it('should accept partial visibility update', () => {
				const data = {
					visibility: 'PRIVATE' as Visibility,
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});

			it('should accept multiple partial updates', () => {
				const data = {
					title: 'New Title',
					language: 'python' as const,
					visibility: 'AUTHENTICATED' as Visibility,
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});
		});

		describe('versioning validation', () => {
			it('should accept versionHistoryVisible when versioning is enabled', () => {
				const data = {
					versioningEnabled: true,
					versionHistoryVisible: true,
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});

			it('should reject versionHistoryVisible when versioning is disabled', () => {
				const data = {
					versioningEnabled: false,
					versionHistoryVisible: true,
				};
				expect(() => UpdatePasteSchema.parse(data)).toThrow(
					'Version history visibility can only be enabled when versioning is enabled'
				);
			});
		});

		describe('expiry date validation', () => {
			it('should accept future expiry dates', () => {
				const futureDate = new Date();
				futureDate.setDate(futureDate.getDate() + 7);

				const data = {
					expiresAt: futureDate,
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});

			it('should accept null expiry date (remove expiry)', () => {
				const data = {
					expiresAt: null,
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});

			it('should reject past expiry dates', () => {
				const pastDate = new Date();
				pastDate.setDate(pastDate.getDate() - 1);

				const data = {
					expiresAt: pastDate,
				};
				expect(() => UpdatePasteSchema.parse(data)).toThrow('Expiry date must be in the future');
			});
		});

		describe('nullable password', () => {
			it('should accept null password (remove password)', () => {
				const data = {
					password: null,
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});

			it('should accept string password', () => {
				const data = {
					password: 'newpassword',
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});

			it('should accept undefined password', () => {
				const data = {
					password: undefined,
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});
		});

		describe('invited and removed users', () => {
			it('should accept invitedUsers array', () => {
				const data = {
					invitedUsers: ['user1', 'user2'],
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});

			it('should accept removedUsers array', () => {
				const data = {
					removedUsers: ['user1'],
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});

			it('should accept both invitedUsers and removedUsers', () => {
				const data = {
					invitedUsers: ['user2', 'user3'],
					removedUsers: ['user1'],
				};
				expect(() => UpdatePasteSchema.parse(data)).not.toThrow();
			});
		});
	});

	describe('PasteViewSchema', () => {
		it('should accept valid slug', () => {
			const data = { slug: 'my-paste-slug' };
			expect(() => PasteViewSchema.parse(data)).not.toThrow();
		});

		it('should accept any non-empty string as slug', () => {
			const validSlugs = ['abc', '123', 'test-slug', 'ABCDEF1234'];
			validSlugs.forEach((slug) => {
				expect(() => PasteViewSchema.parse({ slug })).not.toThrow();
			});
		});

		it('should reject empty slug', () => {
			const data = { slug: '' };
			expect(() => PasteViewSchema.parse(data)).toThrow('Invalid paste identifier');
		});

		it('should reject missing slug', () => {
			expect(() => PasteViewSchema.parse({})).toThrow();
		});
	});

	describe('SinglePasteDataSchema', () => {
		const validPasteData = {
			id: 'paste-123',
			customSlug: 'my-paste',
			title: 'Test Paste',
			language: 'javascript' as const,
			visibility: 'PUBLIC' as Visibility,
			views: 42,
			createdAt: new Date(),
			updatedAt: new Date(),
			expiresAt: null,
			owner_id: 'user-456',
			ownerUsername: 'testuser',
			hasPassword: false,
		};

		it('should accept valid paste data', () => {
			expect(() => SinglePasteDataSchema.parse(validPasteData)).not.toThrow();
		});

		it('should accept null values for nullable fields', () => {
			const data = {
				...validPasteData,
				customSlug: null,
				title: null,
				language: null,
				expiresAt: null,
				ownerUsername: null,
			};
			expect(() => SinglePasteDataSchema.parse(data)).not.toThrow();
		});

		it('should reject negative views', () => {
			const data = { ...validPasteData, views: -1 };
			expect(() => SinglePasteDataSchema.parse(data)).toThrow();
		});

		it('should reject non-integer views', () => {
			const data = { ...validPasteData, views: 42.5 };
			expect(() => SinglePasteDataSchema.parse(data)).toThrow();
		});

		it('should reject missing required fields', () => {
			const requiredFields = [
				'id',
				'visibility',
				'views',
				'createdAt',
				'updatedAt',
				'owner_id',
			] as const;

			requiredFields.forEach((field) => {
				const { [field]: _, ...incomplete } = validPasteData;
				expect(() => SinglePasteDataSchema.parse(incomplete)).toThrow();
			});
		});

		it('should accept valid visibility values', () => {
			VISIBILITY_VALUES.forEach((visibility) => {
				const data = { ...validPasteData, visibility };
				expect(() => SinglePasteDataSchema.parse(data)).not.toThrow();
			});
		});

		it('should reject invalid visibility values', () => {
			const data = { ...validPasteData, visibility: 'INVALID' };
			expect(() => SinglePasteDataSchema.parse(data)).toThrow();
		});

		it('should accept boolean hasPassword values', () => {
			expect(() =>
				SinglePasteDataSchema.parse({ ...validPasteData, hasPassword: true })
			).not.toThrow();
			expect(() =>
				SinglePasteDataSchema.parse({ ...validPasteData, hasPassword: false })
			).not.toThrow();
		});
	});

	describe('type exports', () => {
		it('should export Visibility type', () => {
			const visibility: Visibility = 'PUBLIC';
			expect(visibility).toBe('PUBLIC');
		});

		it('should export CreatePasteData type', () => {
			const data: CreatePasteData = {
				content: 'test',
				visibility: 'PUBLIC',
				language: 'plaintext',
				burnAfterReading: false,
			};
			expect(data.content).toBe('test');
		});

		it('should export UpdatePasteData type', () => {
			const data: UpdatePasteData = {
				title: 'Updated Title',
			};
			expect(data.title).toBe('Updated Title');
		});

		it('should export InvitedUser type', () => {
			const user: InvitedUser = {
				id: 'user-123',
				username: 'testuser',
				displayUsername: 'Test User',
				invitedAt: new Date(),
			};
			expect(user.username).toBe('testuser');
		});

		it('should export SinglePasteData type', () => {
			const paste: SinglePasteData = {
				id: 'paste-123',
				customSlug: null,
				title: null,
				language: 'javascript',
				visibility: 'PUBLIC',
				views: 10,
				createdAt: new Date(),
				updatedAt: new Date(),
				expiresAt: null,
				owner_id: 'user-456',
				ownerUsername: 'testuser',
				hasPassword: false,
			};
			expect(paste.id).toBe('paste-123');
		});
	});

	describe('integration tests', () => {
		it('should handle full paste creation workflow', () => {
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 30);

			const pasteData: CreatePasteData = {
				content: 'function hello() { console.log("Hello"); }',
				visibility: 'AUTHENTICATED',
				customSlug: 'my-function',
				language: 'javascript',
				title: 'My Hello Function',
				password: 'secret',
				expiresAt: futureDate,
				burnAfterReading: false,
				versioningEnabled: true,
				versionHistoryVisible: true,
			};

			expect(() => CreatePasteSchema.parse(pasteData)).not.toThrow();
		});

		it('should handle full paste update workflow', () => {
			const updateData: UpdatePasteData = {
				content: 'Updated content',
				title: 'Updated Title',
				visibility: 'PRIVATE',
				password: null, // remove password
				versioningEnabled: true,
				invitedUsers: ['user1'],
				removedUsers: ['user2'],
			};

			expect(() => UpdatePasteSchema.parse(updateData)).not.toThrow();
		});

		it('should maintain consistency between schemas', () => {
			// visibility values should be consistent
			expect(VisibilitySchema.options).toEqual(VISIBILITY_VALUES);

			// visibility options should match VISIBILITY_VALUES
			const optionValues = visibilityOptions.map((o) => o.value);
			expect(optionValues.sort()).toEqual([...VISIBILITY_VALUES].sort());
		});
	});
});
