/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import {
	type AddRoleFormData,
	AddRoleFormSchema,
	type AddUserFormData,
	AddUserFormSchema,
	type EditRoleFormData,
	EditRoleFormSchema,
	type EditUserFormData,
	EditUserFormSchema,
	USERNAME_PLACEHOLDER,
} from './user-management';

describe('user-management.ts', () => {
	describe('AddUserFormSchema', () => {
		const validUserData = {
			username: 'testuser',
			email: 'test@example.com',
			password: 'Password123!',
			role: 'user' as const,
		};

		it('should accept valid user data', () => {
			expect(() => AddUserFormSchema.parse(validUserData)).not.toThrow();
		});

		it('should accept admin role', () => {
			const data = { ...validUserData, role: 'admin' as const };
			expect(() => AddUserFormSchema.parse(data)).not.toThrow();
		});

		describe('username validation', () => {
			it('should accept valid usernames', () => {
				const validUsernames = ['user123', 'test_user', 'user-name', 'ABC', 'a1b2c3'];

				validUsernames.forEach((username) => {
					const data = { ...validUserData, username };
					expect(() => AddUserFormSchema.parse(data)).not.toThrow();
				});
			});

			it('should reject username shorter than 3 characters', () => {
				const data = { ...validUserData, username: 'ab' };
				expect(() => AddUserFormSchema.parse(data)).toThrow(
					'Username must be at least 3 characters'
				);
			});

			it('should reject username longer than 50 characters', () => {
				const data = { ...validUserData, username: 'a'.repeat(51) };
				expect(() => AddUserFormSchema.parse(data)).toThrow('Username is too long');
			});

			it('should reject username with spaces', () => {
				const data = { ...validUserData, username: 'user name' };
				expect(() => AddUserFormSchema.parse(data)).toThrow();
			});

			it('should reject username with special characters', () => {
				const invalidUsernames = ['user@name', 'user.name', 'user!', 'user#123', 'user$'];

				invalidUsernames.forEach((username) => {
					const data = { ...validUserData, username };
					expect(() => AddUserFormSchema.parse(data)).toThrow();
				});
			});

			it('should reject username with dangerous characters', () => {
				const dangerousUsernames = [
					'user<script>',
					'user"test',
					"user'test",
					'user;drop',
					'user\\test',
				];

				dangerousUsernames.forEach((username) => {
					const data = { ...validUserData, username };
					expect(() => AddUserFormSchema.parse(data)).toThrow();
				});
			});

			it('should trim whitespace from username', () => {
				const data = { ...validUserData, username: '  testuser  ' };
				const result = AddUserFormSchema.parse(data);
				expect(result.username).toBe('testuser');
			});
		});

		describe('email validation', () => {
			it('should accept valid email addresses', () => {
				const validEmails = [
					'test@example.com',
					'user.name@example.com',
					'user+tag@example.co.uk',
					'test123@test-domain.com',
				];

				validEmails.forEach((email) => {
					const data = { ...validUserData, email };
					expect(() => AddUserFormSchema.parse(data)).not.toThrow();
				});
			});

			it('should accept empty string for email', () => {
				const data = { ...validUserData, email: '' };
				expect(() => AddUserFormSchema.parse(data)).not.toThrow();
			});

			it('should reject invalid email format', () => {
				const invalidEmails = [
					'notanemail',
					'test@',
					'@example.com',
					'test@.com',
					'test..@example.com',
				];

				invalidEmails.forEach((email) => {
					const data = { ...validUserData, email };
					expect(() => AddUserFormSchema.parse(data)).toThrow();
				});
			});

			it('should reject email longer than 80 characters', () => {
				const longEmail = 'a'.repeat(70) + '@example.com';
				const data = { ...validUserData, email: longEmail };
				expect(() => AddUserFormSchema.parse(data)).toThrow('Email is too long');
			});

			it('should reject email with dangerous characters', () => {
				const dangerousEmails = [
					'test<script>@example.com',
					'test"@example.com',
					"test'@example.com",
					'test;@example.com',
					'test\\@example.com',
				];

				dangerousEmails.forEach((email) => {
					const data = { ...validUserData, email };
					expect(() => AddUserFormSchema.parse(data)).toThrow();
				});
			});

			it('should trim whitespace from email', () => {
				const data = { ...validUserData, email: '  test@example.com  ' };
				const result = AddUserFormSchema.parse(data);
				expect(result.email).toBe('test@example.com');
			});
		});

		describe('password validation', () => {
			it('should accept valid passwords', () => {
				const validPasswords = [
					'Password123!',
					'MyP@ssw0rd',
					'Secure#Pass1',
					'Test1234!@#$',
					'Aa1!bcdefgh',
				];

				validPasswords.forEach((password) => {
					const data = { ...validUserData, password };
					expect(() => AddUserFormSchema.parse(data)).not.toThrow();
				});
			});

			it('should reject password shorter than 8 characters', () => {
				const data = { ...validUserData, password: 'Pass1!' };
				expect(() => AddUserFormSchema.parse(data)).toThrow(
					'Password must be at least 8 characters'
				);
			});

			it('should reject password longer than 32 characters', () => {
				const data = { ...validUserData, password: 'Password123!' + 'a'.repeat(25) };
				expect(() => AddUserFormSchema.parse(data)).toThrow('Password is too long');
			});

			it('should reject password without uppercase letter', () => {
				const data = { ...validUserData, password: 'password123!' };
				expect(() => AddUserFormSchema.parse(data)).toThrow(
					'Password must contain at least one uppercase letter'
				);
			});

			it('should reject password without lowercase letter', () => {
				const data = { ...validUserData, password: 'PASSWORD123!' };
				expect(() => AddUserFormSchema.parse(data)).toThrow(
					'Password must contain at least one lowercase letter'
				);
			});

			it('should reject password without number', () => {
				const data = { ...validUserData, password: 'Password!' };
				expect(() => AddUserFormSchema.parse(data)).toThrow(
					'Password must contain at least one number'
				);
			});

			it('should reject password without special character', () => {
				const data = { ...validUserData, password: 'Password123' };
				expect(() => AddUserFormSchema.parse(data)).toThrow(
					'Password must contain at least one special character'
				);
			});

			it('should reject password with dangerous characters', () => {
				const dangerousPasswords = [
					'Pass<word123!',
					'Pass>word123!',
					'Pass"word123!',
					"Pass'word123!",
					'Pass`word123!',
					'Pass;word123!',
					'Pass\\word123!',
					'Pass/word123!',
				];

				dangerousPasswords.forEach((password) => {
					const data = { ...validUserData, password };
					expect(() => AddUserFormSchema.parse(data)).toThrow('Invalid characters detected');
				});
			});
		});

		describe('role validation', () => {
			it('should accept user role', () => {
				const data = { ...validUserData, role: 'user' as const };
				expect(() => AddUserFormSchema.parse(data)).not.toThrow();
			});

			it('should accept admin role', () => {
				const data = { ...validUserData, role: 'admin' as const };
				expect(() => AddUserFormSchema.parse(data)).not.toThrow();
			});

			it('should reject invalid role', () => {
				const data = { ...validUserData, role: 'superuser' as any };
				expect(() => AddUserFormSchema.parse(data)).toThrow();
			});

			it('should reject unauthenticated role', () => {
				const data = { ...validUserData, role: 'unauthenticated' as any };
				expect(() => AddUserFormSchema.parse(data)).toThrow();
			});
		});
	});

	describe('EditUserFormSchema', () => {
		const validEditData = {
			username: 'testuser',
			email: 'test@example.com',
			role: 'user' as const,
			banned: false,
		};

		it('should accept valid edit data', () => {
			expect(() => EditUserFormSchema.parse(validEditData)).not.toThrow();
		});

		it('should accept empty email', () => {
			const data = { ...validEditData, email: '' };
			expect(() => EditUserFormSchema.parse(data)).not.toThrow();
		});

		it('should accept null email', () => {
			const data = { ...validEditData, email: null };
			expect(() => EditUserFormSchema.parse(data)).not.toThrow();
		});

		it('should accept undefined email', () => {
			const data = { ...validEditData, email: undefined };
			expect(() => EditUserFormSchema.parse(data)).not.toThrow();
		});

		describe('banned field validation', () => {
			it('should accept banned as true', () => {
				const data = { ...validEditData, banned: true };
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});

			it('should accept banned as false', () => {
				const data = { ...validEditData, banned: false };
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});

			it('should accept banReason when provided', () => {
				const data = { ...validEditData, banned: true, banReason: 'Violated terms of service' };
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});

			it('should accept missing banReason', () => {
				const data = { ...validEditData, banned: true };
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});
		});

		describe('newPassword validation', () => {
			it('should accept empty string for newPassword', () => {
				const data = { ...validEditData, newPassword: '' };
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});

			it('should accept null for newPassword', () => {
				const data = { ...validEditData, newPassword: null };
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});

			it('should accept undefined for newPassword', () => {
				const data = { ...validEditData, newPassword: undefined };
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});

			it('should accept valid new password', () => {
				const data = { ...validEditData, newPassword: 'NewPassword123!' };
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});

			it('should reject invalid new password (too short)', () => {
				const data = { ...validEditData, newPassword: 'Pass1!' };
				expect(() => EditUserFormSchema.parse(data)).toThrow(
					'Password must be at least 8 characters'
				);
			});

			it('should reject invalid new password (no uppercase)', () => {
				const data = { ...validEditData, newPassword: 'password123!' };
				expect(() => EditUserFormSchema.parse(data)).toThrow(
					'Password must contain at least one uppercase letter'
				);
			});

			it('should reject invalid new password (no lowercase)', () => {
				const data = { ...validEditData, newPassword: 'PASSWORD123!' };
				expect(() => EditUserFormSchema.parse(data)).toThrow(
					'Password must contain at least one lowercase letter'
				);
			});

			it('should reject invalid new password (no number)', () => {
				const data = { ...validEditData, newPassword: 'Password!' };
				expect(() => EditUserFormSchema.parse(data)).toThrow(
					'Password must contain at least one number'
				);
			});

			it('should reject invalid new password (no special character)', () => {
				const data = { ...validEditData, newPassword: 'Password123' };
				expect(() => EditUserFormSchema.parse(data)).toThrow(
					'Password must contain at least one special character'
				);
			});

			it('should reject new password with dangerous characters', () => {
				const data = { ...validEditData, newPassword: 'Pass<word123!' };
				expect(() => EditUserFormSchema.parse(data)).toThrow('Invalid characters detected');
			});
		});

		describe('edge cases', () => {
			it('should accept all optional fields as undefined', () => {
				const data = {
					username: 'testuser',
					email: undefined,
					role: 'user' as const,
					banned: false,
					banReason: undefined,
					newPassword: undefined,
				};
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});

			it('should accept banned user with reason', () => {
				const data = {
					...validEditData,
					banned: true,
					banReason: 'Spam activity detected',
				};
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});

			it('should accept role change to admin', () => {
				const data = { ...validEditData, role: 'admin' as const };
				expect(() => EditUserFormSchema.parse(data)).not.toThrow();
			});
		});
	});

	describe('AddRoleFormSchema', () => {
		const validRoleData = {
			name: 'Moderator',
			description: 'Can moderate content',
			permissionIds: [1, 2, 3],
		};

		it('should accept valid role data', () => {
			expect(() => AddRoleFormSchema.parse(validRoleData)).not.toThrow();
		});

		describe('name validation', () => {
			it('should accept valid role names', () => {
				const validNames = ['Admin', 'User', 'Moderator', 'AB', 'a'.repeat(50)];

				validNames.forEach((name) => {
					const data = { ...validRoleData, name };
					expect(() => AddRoleFormSchema.parse(data)).not.toThrow();
				});
			});

			it('should reject name shorter than 2 characters', () => {
				const data = { ...validRoleData, name: 'A' };
				expect(() => AddRoleFormSchema.parse(data)).toThrow(
					'Role name must be at least 2 characters'
				);
			});

			it('should reject name longer than 50 characters', () => {
				const data = { ...validRoleData, name: 'a'.repeat(51) };
				expect(() => AddRoleFormSchema.parse(data)).toThrow(
					'Role name cannot exceed 50 characters'
				);
			});

			it('should accept name with spaces', () => {
				const data = { ...validRoleData, name: 'Super Admin' };
				expect(() => AddRoleFormSchema.parse(data)).not.toThrow();
			});

			it('should accept name with special characters', () => {
				const data = { ...validRoleData, name: 'Admin-Level-1' };
				expect(() => AddRoleFormSchema.parse(data)).not.toThrow();
			});
		});

		describe('description validation', () => {
			it('should accept valid descriptions', () => {
				const validDescriptions = [
					'Can manage users',
					'Has full access to the system',
					'a'.repeat(200),
				];

				validDescriptions.forEach((description) => {
					const data = { ...validRoleData, description };
					expect(() => AddRoleFormSchema.parse(data)).not.toThrow();
				});
			});

			it('should accept null description', () => {
				const data = { ...validRoleData, description: null };
				expect(() => AddRoleFormSchema.parse(data)).not.toThrow();
			});

			it('should accept undefined description', () => {
				const data = { ...validRoleData, description: undefined };
				expect(() => AddRoleFormSchema.parse(data)).not.toThrow();
			});

			it('should accept empty string description', () => {
				const data = { ...validRoleData, description: '' };
				expect(() => AddRoleFormSchema.parse(data)).not.toThrow();
			});

			it('should reject description longer than 200 characters', () => {
				const data = { ...validRoleData, description: 'a'.repeat(201) };
				expect(() => AddRoleFormSchema.parse(data)).toThrow(
					'Description cannot exceed 200 characters'
				);
			});
		});

		describe('permissionIds validation', () => {
			it('should accept array of numbers', () => {
				const data = { ...validRoleData, permissionIds: [1, 2, 3, 4, 5] };
				expect(() => AddRoleFormSchema.parse(data)).not.toThrow();
			});

			it('should accept array of strings and convert to numbers', () => {
				const data = { ...validRoleData, permissionIds: ['1', '2', '3'] as any };
				const result = AddRoleFormSchema.parse(data);
				expect(result.permissionIds).toEqual([1, 2, 3]);
			});

			it('should accept mixed array of strings and numbers', () => {
				const data = { ...validRoleData, permissionIds: [1, '2', 3, '4'] as any };
				const result = AddRoleFormSchema.parse(data);
				expect(result.permissionIds).toEqual([1, 2, 3, 4]);
			});

			it('should accept empty array', () => {
				const data = { ...validRoleData, permissionIds: [] };
				expect(() => AddRoleFormSchema.parse(data)).not.toThrow();
			});

			it('should reject non-numeric strings', () => {
				const data = { ...validRoleData, permissionIds: ['abc', 'def'] as any };
				expect(() => AddRoleFormSchema.parse(data)).toThrow();
			});

			it('should accept single permission', () => {
				const data = { ...validRoleData, permissionIds: [1] };
				expect(() => AddRoleFormSchema.parse(data)).not.toThrow();
			});
		});
	});

	describe('EditRoleFormSchema', () => {
		const validEditRoleData = {
			name: 'Updated Role',
			description: 'Updated description',
			permissionIds: [1, 2, 3],
		};

		it('should accept valid edit role data', () => {
			expect(() => EditRoleFormSchema.parse(validEditRoleData)).not.toThrow();
		});

		it('should have same validation as AddRoleFormSchema for name', () => {
			const tooShort = { ...validEditRoleData, name: 'A' };
			expect(() => EditRoleFormSchema.parse(tooShort)).toThrow(
				'Role name must be at least 2 characters'
			);

			const tooLong = { ...validEditRoleData, name: 'a'.repeat(51) };
			expect(() => EditRoleFormSchema.parse(tooLong)).toThrow(
				'Role name cannot exceed 50 characters'
			);
		});

		it('should have same validation as AddRoleFormSchema for description', () => {
			const tooLong = { ...validEditRoleData, description: 'a'.repeat(201) };
			expect(() => EditRoleFormSchema.parse(tooLong)).toThrow(
				'Description cannot exceed 200 characters'
			);

			const nullDesc = { ...validEditRoleData, description: null };
			expect(() => EditRoleFormSchema.parse(nullDesc)).not.toThrow();
		});

		it('should have same validation as AddRoleFormSchema for permissionIds', () => {
			const stringIds = { ...validEditRoleData, permissionIds: ['1', '2', '3'] as any };
			const result = EditRoleFormSchema.parse(stringIds);
			expect(result.permissionIds).toEqual([1, 2, 3]);

			const emptyArray = { ...validEditRoleData, permissionIds: [] };
			expect(() => EditRoleFormSchema.parse(emptyArray)).not.toThrow();
		});
	});

	describe('type exports', () => {
		it('should export AddUserFormData type', () => {
			const data: AddUserFormData = {
				username: 'testuser',
				email: 'test@example.com',
				password: 'Password123!',
				role: 'user',
			};
			expect(data.username).toBe('testuser');
		});

		it('should export EditUserFormData type', () => {
			const data: EditUserFormData = {
				username: 'testuser',
				email: 'test@example.com',
				role: 'admin',
				banned: false,
				newPassword: null,
				banReason: undefined,
			};
			expect(data.role).toBe('admin');
		});

		it('should export AddRoleFormData type', () => {
			const data: AddRoleFormData = {
				name: 'Moderator',
				description: 'Can moderate',
				permissionIds: [1, 2, 3],
			};
			expect(data.name).toBe('Moderator');
		});

		it('should export EditRoleFormData type', () => {
			const data: EditRoleFormData = {
				name: 'Updated Role',
				description: null,
				permissionIds: [1],
			};
			expect(data.name).toBe('Updated Role');
		});
	});

	describe('USERNAME_PLACEHOLDER', () => {
		it('should be defined', () => {
			expect(USERNAME_PLACEHOLDER).toBeDefined();
		});

		it('should have correct value', () => {
			expect(USERNAME_PLACEHOLDER).toBe('@username.placeholder');
		});
	});

	describe('integration tests', () => {
		it('should handle complete user creation workflow', () => {
			const userData: AddUserFormData = {
				username: 'newuser123',
				email: 'newuser@example.com',
				password: 'SecurePass123!',
				role: 'user',
			};

			expect(() => AddUserFormSchema.parse(userData)).not.toThrow();
		});

		it('should handle complete user edit workflow', () => {
			const editData: EditUserFormData = {
				username: 'updateduser',
				email: 'updated@example.com',
				role: 'admin',
				banned: true,
				banReason: 'Policy violation',
				newPassword: 'NewSecure123!',
			};

			expect(() => EditUserFormSchema.parse(editData)).not.toThrow();
		});

		it('should handle complete role creation workflow', () => {
			const roleData: AddRoleFormData = {
				name: 'Content Manager',
				description: 'Can manage content and moderate users',
				permissionIds: [1, 2, 3, 4, 5],
			};

			expect(() => AddRoleFormSchema.parse(roleData)).not.toThrow();
		});

		it('should handle role edit with permission changes', () => {
			const editRoleData: EditRoleFormData = {
				name: 'Senior Moderator',
				description: 'Enhanced moderation capabilities',
				permissionIds: [1, 2, 3, 4, 5, 6, 7],
			};

			expect(() => EditRoleFormSchema.parse(editRoleData)).not.toThrow();
		});
	});
});
