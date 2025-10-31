/**
 * Server-only Better Auth role definitions
 * For shared constants (RoleNames, PERMISSIONS), import from './roles-shared'
 */
import { user } from '$database/schema';
import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc } from 'better-auth/plugins/admin/access';
import { eq } from 'drizzle-orm';
import { type AuthedRoleName, PERMISSIONS } from '$lib/auth/roles-shared';
import { db } from '$src/lib/server/db';

// Types for permission checking
export type PermissionGroup = keyof typeof statement;

// Simple type that restricts keys to valid permission groups while being compatible with better-auth
export type PermissionCheckRecord = {
	[K in PermissionGroup]?: readonly string[];
};

const statement = {
	user: Object.values(PERMISSIONS.user),
	session: Object.values(PERMISSIONS.session),
	pastes: Object.values(PERMISSIONS.pastes),
} as const;

export const ac = createAccessControl(statement);

export const ROLES = {
	user: ac.newRole({
		pastes: [
			PERMISSIONS.pastes.create,
			PERMISSIONS.pastes['read:public'],
			PERMISSIONS.pastes['read:authenticated'],
			PERMISSIONS.pastes['read:invited'],
			PERMISSIONS.pastes['read:private'],
			PERMISSIONS.pastes['update:own'],
			PERMISSIONS.pastes['delete:own'],
		],
		user: [PERMISSIONS.user['get:own']],
	}),

	admin: ac.newRole({
		...adminAc.statements,
		pastes: Object.values(PERMISSIONS.pastes),
		user: Object.values(PERMISSIONS.user),
	}),
	unauthenticated: ac.newRole({
		pastes: [PERMISSIONS.pastes['read:public']],
	}),
};

export const updateUserRole = async (userId: string, role: AuthedRoleName) => {
	const result = await db.update(user).set({ role }).where(eq(user.id, userId));

	return result;
};
