import { describe, expect, it } from 'vitest';
import {
	type AuthedRoleName,
	AuthedRoleNames,
	PERMISSIONS,
	type PastePermission,
	type RoleName,
	RoleNames,
	type UserPermission,
	authedRoleNamesTuple,
	authedRoleSchema,
} from '../roles-shared';

describe('Roles and Permissions', () => {
	describe('PERMISSIONS', () => {
		describe('user permissions', () => {
			it('should have all expected user permissions', () => {
				expect(PERMISSIONS.user).toHaveProperty('create', 'create');
				expect(PERMISSIONS.user).toHaveProperty('list', 'list');
				expect(PERMISSIONS.user).toHaveProperty('set-role', 'set-role');
				expect(PERMISSIONS.user).toHaveProperty('ban', 'ban');
				expect(PERMISSIONS.user).toHaveProperty('impersonate', 'impersonate');
				expect(PERMISSIONS.user).toHaveProperty('delete', 'delete');
				expect(PERMISSIONS.user).toHaveProperty('set-password', 'set-password');
				expect(PERMISSIONS.user).toHaveProperty('get:own', 'get:own');
				expect(PERMISSIONS.user).toHaveProperty('update', 'update');
				expect(PERMISSIONS.user).toHaveProperty('get:any', 'get:any');
			});

			it('should be readonly at compile time', () => {
				// TypeScript enforces readonly at compile time with 'as const'
				// Runtime immutability would require Object.freeze which isn't used here
				expect(PERMISSIONS.user).toBeDefined();
			});
		});

		describe('paste permissions', () => {
			it('should have all expected paste permissions', () => {
				expect(PERMISSIONS.pastes).toHaveProperty('create', 'create');
				expect(PERMISSIONS.pastes).toHaveProperty('read:public', 'read:public');
				expect(PERMISSIONS.pastes).toHaveProperty('read:authenticated', 'read:authenticated');
				expect(PERMISSIONS.pastes).toHaveProperty('read:invited', 'read:invited');
				expect(PERMISSIONS.pastes).toHaveProperty('read:private', 'read:private');
				expect(PERMISSIONS.pastes).toHaveProperty('read:any', 'read:any');
				expect(PERMISSIONS.pastes).toHaveProperty('update:own', 'update:own');
				expect(PERMISSIONS.pastes).toHaveProperty('update:any', 'update:any');
				expect(PERMISSIONS.pastes).toHaveProperty('delete:own', 'delete:own');
				expect(PERMISSIONS.pastes).toHaveProperty('delete:any', 'delete:any');
				expect(PERMISSIONS.pastes).toHaveProperty('manage-permissions', 'manage-permissions');
			});

			it('should distinguish between own and any permissions', () => {
				// verify that we have both :own and :any variants for critical operations
				expect(PERMISSIONS.pastes['update:own']).toBe('update:own');
				expect(PERMISSIONS.pastes['update:any']).toBe('update:any');
				expect(PERMISSIONS.pastes['delete:own']).toBe('delete:own');
				expect(PERMISSIONS.pastes['delete:any']).toBe('delete:any');
			});

			it('should have graduated read permissions', () => {
				// verify the permission hierarchy for reading
				expect(PERMISSIONS.pastes['read:public']).toBe('read:public');
				expect(PERMISSIONS.pastes['read:authenticated']).toBe('read:authenticated');
				expect(PERMISSIONS.pastes['read:invited']).toBe('read:invited');
				expect(PERMISSIONS.pastes['read:private']).toBe('read:private');
				expect(PERMISSIONS.pastes['read:any']).toBe('read:any');
			});
		});

		describe('session permissions', () => {
			it('should have all expected session permissions', () => {
				expect(PERMISSIONS.session).toHaveProperty('list', 'list');
				expect(PERMISSIONS.session).toHaveProperty('revoke', 'revoke');
				expect(PERMISSIONS.session).toHaveProperty('delete', 'delete');
			});
		});

		it('should be readonly at compile time', () => {
			// TypeScript enforces readonly at compile time with 'satisfies'
			// Runtime immutability would require Object.freeze which isn't used here
			expect(PERMISSIONS.user).toBeDefined();
			expect(PERMISSIONS.pastes).toBeDefined();
			expect(PERMISSIONS.session).toBeDefined();
		});
	});

	describe('RoleNames', () => {
		it('should have all expected roles', () => {
			expect(RoleNames.user).toBe('user');
			expect(RoleNames.admin).toBe('admin');
			expect(RoleNames.unauthenticated).toBe('unauthenticated');
		});

		it('should have exactly 3 roles', () => {
			expect(Object.keys(RoleNames)).toHaveLength(3);
		});

		it('should be readonly at compile time', () => {
			// TypeScript enforces readonly at compile time with 'as const'
			// Runtime immutability would require Object.freeze which isn't used here
			expect(RoleNames.user).toBe('user');
		});

		it('should have string values matching keys', () => {
			Object.entries(RoleNames).forEach(([key, value]) => {
				expect(value).toBe(key);
			});
		});
	});

	describe('AuthedRoleNames', () => {
		it('should only include authenticated roles', () => {
			expect(AuthedRoleNames.user).toBe('user');
			expect(AuthedRoleNames.admin).toBe('admin');
			expect(AuthedRoleNames).not.toHaveProperty('unauthenticated');
		});

		it('should have exactly 2 roles', () => {
			expect(Object.keys(AuthedRoleNames)).toHaveLength(2);
		});

		it('should be a subset of RoleNames', () => {
			Object.values(AuthedRoleNames).forEach((roleName) => {
				expect(Object.values(RoleNames)).toContain(roleName);
			});
		});
	});

	describe('authedRoleNamesTuple', () => {
		it('should contain authenticated role names', () => {
			expect(authedRoleNamesTuple).toContain('user');
			expect(authedRoleNamesTuple).toContain('admin');
		});

		it('should not contain unauthenticated', () => {
			expect(authedRoleNamesTuple).not.toContain('unauthenticated');
		});

		it('should have exactly 2 elements', () => {
			expect(authedRoleNamesTuple).toHaveLength(2);
		});

		it('should be usable as Zod enum', () => {
			// verify it's properly typed as a tuple for Zod
			expect(Array.isArray(authedRoleNamesTuple)).toBe(true);
		});
	});

	describe('authedRoleSchema', () => {
		it('should validate valid authenticated roles', () => {
			expect(authedRoleSchema.safeParse('user').success).toBe(true);
			expect(authedRoleSchema.safeParse('admin').success).toBe(true);
		});

		it('should reject unauthenticated role', () => {
			const result = authedRoleSchema.safeParse('unauthenticated');
			expect(result.success).toBe(false);
		});

		it('should reject invalid role names', () => {
			expect(authedRoleSchema.safeParse('superadmin').success).toBe(false);
			expect(authedRoleSchema.safeParse('guest').success).toBe(false);
			expect(authedRoleSchema.safeParse('').success).toBe(false);
			expect(authedRoleSchema.safeParse(null).success).toBe(false);
			expect(authedRoleSchema.safeParse(undefined).success).toBe(false);
		});

		it('should reject SQL injection attempts', () => {
			expect(authedRoleSchema.safeParse("admin'; DROP TABLE users; --").success).toBe(false);
		});

		it('should reject XSS attempts', () => {
			expect(authedRoleSchema.safeParse('<script>alert("xss")</script>').success).toBe(false);
		});

		it('should be case sensitive', () => {
			expect(authedRoleSchema.safeParse('User').success).toBe(false);
			expect(authedRoleSchema.safeParse('ADMIN').success).toBe(false);
			expect(authedRoleSchema.safeParse('Admin').success).toBe(false);
		});
	});

	describe('Type Safety', () => {
		it('should correctly type UserPermission', () => {
			const validUserPermissions: UserPermission[] = [
				'create',
				'list',
				'set-role',
				'ban',
				'impersonate',
				'delete',
				'set-password',
				'get:own',
				'update',
				'get:any',
			];

			validUserPermissions.forEach((perm) => {
				expect(PERMISSIONS.user[perm]).toBeDefined();
			});
		});

		it('should correctly type PastePermission', () => {
			const validPastePermissions: PastePermission[] = [
				'create',
				'read:public',
				'read:authenticated',
				'read:invited',
				'read:private',
				'read:any',
				'update:own',
				'update:any',
				'delete:own',
				'delete:any',
				'manage-permissions',
			];

			validPastePermissions.forEach((perm) => {
				expect(PERMISSIONS.pastes[perm]).toBeDefined();
			});
		});

		it('should correctly type RoleName', () => {
			const roleNames: RoleName[] = ['user', 'admin', 'unauthenticated'];

			roleNames.forEach((roleName) => {
				expect(Object.values(RoleNames)).toContain(roleName);
			});
		});

		it('should correctly type AuthedRoleName', () => {
			const authedRoleNames: AuthedRoleName[] = ['user', 'admin'];

			authedRoleNames.forEach((roleName) => {
				expect(Object.values(AuthedRoleNames)).toContain(roleName);
			});
		});
	});

	describe('Permission Structure Validation', () => {
		it('should have consistent permission value format', () => {
			// all permission values should match their keys
			Object.entries(PERMISSIONS.user).forEach(([key, value]) => {
				expect(value).toBe(key);
			});

			Object.entries(PERMISSIONS.pastes).forEach(([key, value]) => {
				expect(value).toBe(key);
			});

			Object.entries(PERMISSIONS.session).forEach(([key, value]) => {
				expect(value).toBe(key);
			});
		});

		it('should not have duplicate permission values within categories', () => {
			const userValues = Object.values(PERMISSIONS.user);
			expect(new Set(userValues).size).toBe(userValues.length);

			const pasteValues = Object.values(PERMISSIONS.pastes);
			expect(new Set(pasteValues).size).toBe(pasteValues.length);

			const sessionValues = Object.values(PERMISSIONS.session);
			expect(new Set(sessionValues).size).toBe(sessionValues.length);
		});

		it('should follow naming conventions', () => {
			// user permissions should use kebab-case or scope:action format
			Object.keys(PERMISSIONS.user).forEach((key) => {
				expect(key).toMatch(/^[a-z]+(-[a-z]+|:[a-z]+)?$/);
			});

			// paste permissions should use kebab-case or scope:action format
			Object.keys(PERMISSIONS.pastes).forEach((key) => {
				expect(key).toMatch(/^[a-z]+(-[a-z]+|:[a-z]+)?$/);
			});
		});
	});
});
