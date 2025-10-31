import { env as envPrivate } from '$env/dynamic/private';
import { env } from '$env/dynamic/public';
import { type DBUser, user as userTable } from '@/database/schema';
import { createChildLogger } from '@/src/lib/server/logger';
import { secureUsername } from '@/src/lib/shared/auth';
import { isUnauthenticatedUser } from '@/src/lib/utils/format';
import { type ActionFailure, error, fail } from '@sveltejs/kit';
import { type BetterAuthOptions, type User, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin as adminPlugin, customSession, username } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { eq, sql } from 'drizzle-orm';
import { building } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { RoleNames } from '$src/lib/auth/roles-shared';
import { type PermissionCheckRecord, ROLES, ac } from '$src/lib/server/roles';
import { getSetting } from '$src/lib/server/settings';

if (!building) {
	if (!env.PUBLIC_WEB_UI_URL) throw new Error('PUBLIC_WEB_UI_URL is not set');
} else {
	env.PUBLIC_WEB_UI_URL = 'http://localhost:5173';
	envPrivate.BETTER_AUTH_SECRET = 'build-time-secret-will-be-replaced-at-runtime';
}

const logger = createChildLogger('server/auth');

const options = {
	baseURL: env.PUBLIC_WEB_UI_URL,
	database: drizzleAdapter(db, {
		provider: 'pg',
	}),
	secret: envPrivate.BETTER_AUTH_SECRET,
	// https://www.better-auth.com/docs/concepts/session-management#session-caching
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 60 * 60,
		},
	},

	// https://www.better-auth.com/docs/concepts/oauth
	// socialProviders: {
	// 	github: {
	// 		clientId: GITHUB_CLIENT_ID!,
	// 		clientSecret: GITHUB_CLIENT_SECRET!,
	// 	},

	// google: {
	// 	clientId: env.GOOGLE_CLIENT_ID!,
	// 	clientSecret: env.GOOGLE_CLIENT_SECRET!,
	// },
	// discord: {
	// 	clientId: env.DISCORD_CLIENT_ID!,
	// 	clientSecret: env.DISCORD_CLIENT_SECRET!,
	// },
	// },

	// https://www.better-auth.com/docs/authentication/email-password
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		minPasswordLength: 8,
		maxPasswordLength: 50,
	},

	databaseHooks: {
		user: {
			create: {
				before: async (user, ctx) => {
					// allow admin-created users to bypass public registration check
					const isAdminCreated = (ctx?.body as unknown as { isAdminCreated: boolean })
						?.isAdminCreated;
					if (isAdminCreated) {
						// check setting for first time setup completion
						const allowAdminCreatedUser =
							!(await getSetting('firstTimeSetupCompleted')) || envPrivate.FORCE_FIRST_TIME_SETUP;
						if (allowAdminCreatedUser) {
							logger.info(
								'First-time setup not completed, allowing admin-created user to register'
							);
							return;
						}
					}
					// check if public registration is enabled for regular signups (with env override)
					const registrationEnabled = await getSetting('publicRegistration');

					if (!registrationEnabled) {
						throw new Error('Public registration is currently disabled');
					}
				},
				after: async (user) => {
					logger.info(`Post user creation hook for user: ${user.id} running...`);
					await initializeDefaultUserData(user);
				},
			},
		},
	},
	user: {
		additionalFields: {
			username: {
				type: 'string',
				required: true,
			},
			displayUsername: {
				type: 'string',
			},
		},
	},
	plugins: [
		username({
			usernameValidator: async (username) => {
				const isValid = secureUsername.safeParse(username).success;

				// check if username is not allowed
				if (
					username.trim().toLowerCase() === 'admin' ||
					username.trim().toLowerCase() === 'root' ||
					username.trim().toLowerCase() === 'moderator' ||
					username.trim().toLowerCase() === 'user' ||
					username.trim().toLowerCase() === 'guest' ||
					username.trim().toLowerCase() === 'administrator' ||
					username.trim().toLowerCase() === 'unauthenticated' ||
					username.trim().toLowerCase() === 'owner'
				) {
					return false;
				}

				// check if username exists in database
				const userRes = await db.query.user.findFirst({
					where: eq(userTable.username, username),
				});

				return isValid && !userRes;
			},
		}),
		adminPlugin({
			ac,
			roles: ROLES,
			adminRoles: ['admin'],
			defaultRole: 'user',
		}),
		sveltekitCookies(getRequestEvent),
	],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
	...options,
	plugins: [
		...(options.plugins ?? []),
		customSession(async ({ user: userStore, session }) => {
			const userRes = await db
				.select()
				.from(userTable)
				.where(eq(userTable.id, userStore.id))
				.limit(1);
			if (!userRes[0]) {
				return fail(403, { error: 'Forbidden', message: 'User not found' });
			}
			return {
				user: {
					...userRes[0],
				},
				session,
			};
		}),
	],
});

/**
 * Initialize the default db data for a user with automatic role assignment
 * @param reqUser The user to initialize the user data for
 * @returns The initialized user user data or undefined if the user already has user data or role doesn't exist
 */
export const initializeDefaultUserData = async (reqUser: User): Promise<DBUser | undefined> => {
	// the first user detection runs after the user is created, but before the user data is initialized
	return await db.transaction(async (tx) => {
		// atomically check if this is the first user by counting existing user data to fix race condition
		const existingUserCount = await tx
			.select({ count: sql<number>`count(*)` })
			.from(userTable)
			.then((result) => result[0]?.count || 0);

		// first user counts as user 1 already

		// so check for more than 1 user
		if (existingUserCount > 1) {
			logger.info(`User ${reqUser.id} is not the first user, creating default user data...`);
			// set role to user
			await tx.update(userTable).set({ role: RoleNames.user }).where(eq(userTable.id, reqUser.id));
		} else {
			logger.info(`User ${reqUser.id} is the first user, creating admin user data...`);
			// set role to admin
			await tx.update(userTable).set({ role: RoleNames.admin }).where(eq(userTable.id, reqUser.id));
		}

		const user = await tx.query.user.findFirst({
			where: eq(userTable.id, reqUser.id),
		});
		if (!user) {
			return undefined;
		}

		return user;
	});
};
/**
 * Get the authenticated session from a request, or null if not authenticated
 * @param request The request to get the session from
 * @returns The authenticated session or null if not authenticated
 */
export const getAuthSession = async (request: Request) => {
	const session = await auth.api.getSession({
		headers: request.headers,
	});
	return session;
};

/**
 * Get the authenticated user from a request, or null if not authenticated
 * @param request The request to get the user from
 * @returns The authenticated user or null if not authenticated
 */
export const getAuthUser = async (request: Request): Promise<DBUser | null> => {
	const session = await getAuthSession(request);
	if (!session || !('user' in session)) return null;
	return session.user;
};

/**
 * Middleware function to require specific permissions
 * Throws a 403 error if the user doesn't have the required permissions
 *
 * @param user The db user object or null if the user is unauthenticated
 * @param permissions The required permissions object (e.g., { pastes: ['create'] } or { user: ['ban'] })
 * @throws {error} 403 error if user doesn't have the permissions
 */
export const requirePermission = async (
	user: DBUser | null,
	permissions: Record<string, string[]>
): Promise<void> => {
	const resolvedUser: DBUser | null = user;

	if (isUnauthenticatedUser(resolvedUser)) {
		const hasAccess = await auth.api.userHasPermission({
			body: {
				role: RoleNames.unauthenticated,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				permissions: permissions as any,
			},
		});

		if (!hasAccess.success) {
			logger.info(`Access denied: Missing required permissions "${JSON.stringify(permissions)}"`);
			throw error(403, `Access denied: Unauthorized`);
		}
	} else {
		if (!resolvedUser?.role) {
			throw error(403, `Access denied: Invalid user role`);
		}

		const isAllowed = await auth.api.userHasPermission({
			body: {
				userId: resolvedUser.id,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				permissions: permissions as any,
			},
		});

		// logger.debug(
		// 	`Checked permissions for User '${resolvedUser.user.displayUsername || resolvedUser.user.id}' -> Permissions ${JSON.stringify(permissions)} -> hasAccess -> ${isAllowed.success}`
		// );

		if (!isAllowed.success) {
			logger.info(`Access denied: Missing required permissions "${JSON.stringify(permissions)}"`);
			throw error(403, `Access denied: Unauthorized`);
		}
	}

	return;
};

/**
 * Check if the user has the required permission or return a failure
 * If the user is not authenticated, checks if unauthenticated users have this permission
 * @param request The request to check the user from
 * @param permissions The required permissions object (e.g., { pastes: ['create'] } or { user: ['ban'] })
 * @returns The authenticated user or a failure if the user is not authenticated and the required permission is not granted to unauthenticated users
 */
export const actionRequirePermission = async (
	request: Request,
	permissions: PermissionCheckRecord
): Promise<DBUser | null | ActionFailure<{ error: string; message: string }>> => {
	const user = await getAuthUser(request);

	// if no authenticated user, check if unauthenticated users have this permission
	if (isUnauthenticatedUser(user)) {
		// check if unauthenticated user has the required permissions
		const isUnauthenticatedAllowed = await auth.api.userHasPermission({
			body: {
				role: RoleNames.unauthenticated,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				permissions: permissions as any,
			},
		});
		if (isUnauthenticatedAllowed) {
			return null;
		}

		return fail(403, { error: 'Forbidden', message: 'Authentication required' });
	}

	// check if the user has the required permissions
	if (!user.role) {
		return fail(403, {
			error: 'Forbidden',
			message: 'Invalid user role',
		});
	}

	const isAllowed = await auth.api.userHasPermission({
		body: {
			userId: user.id,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			permissions: permissions as any,
		},
	});

	// logger.debug(
	// 	`(Action) Checked permissions for User ${user.id} -> Permissions ${JSON.stringify(permissions)} -> hasAccess -> ${isAllowed.success}`
	// );

	if (!isAllowed.success) {
		return fail(403, {
			error: 'Forbidden',
			message: `Required permissions: ${JSON.stringify(permissions)}`,
		});
	}

	return user;
};
