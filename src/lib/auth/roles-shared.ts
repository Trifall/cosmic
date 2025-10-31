import z from 'zod';

/**
 * Shared role and permission constants that can be safely used on both client and server
 * Server-only Better Auth role definitions are in lib/server/roles.ts
 */

export const PERMISSIONS = {
	user: {
		create: 'create',
		list: 'list',
		'set-role': 'set-role',
		ban: 'ban',
		impersonate: 'impersonate',
		delete: 'delete',
		'set-password': 'set-password',
		'get:own': 'get:own',
		update: 'update',
		'get:any': 'get:any', // Admin can get any user's statistics
	},
	pastes: {
		create: 'create', // Create new pastes
		'read:public': 'read:public', // Read public pastes (available to all)
		'read:authenticated': 'read:authenticated', // Read pastes visible to authenticated users
		'read:invited': 'read:invited', // Read pastes user was specifically invited to
		'read:private': 'read:private', // Read private pastes (own pastes)
		'read:any': 'read:any', // Admin: read any paste regardless of visibility
		'update:own': 'update:own', // Update own pastes
		'update:any': 'update:any', // Admin: update any paste
		'delete:own': 'delete:own', // Delete own pastes
		'delete:any': 'delete:any', // Admin: delete any paste
		'manage-permissions': 'manage-permissions', // Admin: manage paste permissions for invite-only pastes
	},
	session: {
		list: 'list',
		revoke: 'revoke',
		delete: 'delete',
	},
} as const satisfies Readonly<{
	user: Readonly<Record<string, string>>;
	pastes: Readonly<Record<string, string>>;
	session: Readonly<Record<string, string>>;
}>;

export type UserPermission = keyof typeof PERMISSIONS.user;
export type PastePermission = keyof typeof PERMISSIONS.pastes;
export type Permission = UserPermission | PastePermission;

// Role names as constants
export const RoleNames = {
	user: 'user',
	admin: 'admin',
	unauthenticated: 'unauthenticated',
} as const;

export const AuthedRoleNames = {
	user: RoleNames.user,
	admin: RoleNames.admin,
} as const;

export const authedRoleNamesTuple = Object.keys(AuthedRoleNames) as [
	keyof typeof AuthedRoleNames,
	...Array<keyof typeof AuthedRoleNames>,
];

export const authedRoleSchema = z.enum(authedRoleNamesTuple);

export type AuthedRoleName = z.infer<typeof authedRoleSchema>;
export type RoleName = (typeof RoleNames)[keyof typeof RoleNames];
