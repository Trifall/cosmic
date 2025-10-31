import { env as dynamicEnv } from '$env/dynamic/private';
import { env as envPrivate } from '$env/dynamic/private';
import { env } from '$env/dynamic/public';
import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { createChildLogger } from '$lib/server/logger';
import { getSetting, updateSettingByKey } from '$lib/server/settings';
import { RoleNames } from '$src/lib/auth/roles-shared';
import { USERNAME_PLACEHOLDER } from '$src/lib/auth/user-management';
import { updateUserRole } from '$src/lib/server/roles';
import { signUpSchema } from '$src/lib/shared/auth';
import { processZodErrors } from '$src/lib/utils/format';
import type { Actions, PageServerLoad } from './$types';

const logger = createChildLogger('Setup');

// environment variable configuration
const ENV_VARS = {
	mandatory: [
		{ key: 'PUBLIC_WEB_UI_URL', value: env.PUBLIC_WEB_UI_URL },
		{ key: 'BETTER_AUTH_SECRET', value: envPrivate.BETTER_AUTH_SECRET },
		{ key: 'DB_PASSWORD', value: dynamicEnv.DB_PASSWORD },
		{ key: 'PUBLIC_SITE_NAME', value: env.PUBLIC_SITE_NAME },
	],
	optional: [
		{ key: 'BACKUPS_DIRECTORY', value: dynamicEnv.BACKUPS_DIRECTORY },
		{ key: 'AWS_ACCESS_KEY_ID', value: dynamicEnv.AWS_ACCESS_KEY_ID },
		{ key: 'AWS_SECRET_ACCESS_KEY', value: dynamicEnv.AWS_SECRET_ACCESS_KEY },
		{ key: 'AWS_REGION', value: dynamicEnv.AWS_REGION },
		{ key: 'AWS_S3_BUCKET', value: dynamicEnv.AWS_S3_BUCKET },
		{ key: 'AWS_S3_KEY_PREFIX', value: dynamicEnv.AWS_S3_KEY_PREFIX },
		{ key: 'R2_ACCESS_KEY_ID', value: dynamicEnv.R2_ACCESS_KEY_ID },
		{ key: 'R2_SECRET_ACCESS_KEY', value: dynamicEnv.R2_SECRET_ACCESS_KEY },
		{ key: 'R2_ACCOUNT_ID', value: dynamicEnv.R2_ACCOUNT_ID },
		{ key: 'R2_BUCKET_NAME', value: dynamicEnv.R2_BUCKET_NAME },
		{ key: 'R2_KEY_PREFIX', value: dynamicEnv.R2_KEY_PREFIX },
	],
};

export const load: PageServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (session && 'user' in session) {
		// redirect to home if user is already logged in
		throw redirect(302, '/');
	}

	// check if setup is already completed
	const setupCompleted = await getSetting('firstTimeSetupCompleted');

	if (setupCompleted && dynamicEnv.FORCE_FIRST_TIME_SETUP !== 'true') {
		// redirect to home if setup is already completed
		throw redirect(302, '/');
	}

	// return environment variable status (not values for security)
	return {
		envVars: {
			mandatory: ENV_VARS.mandatory.map((env) => ({
				key: env.key,
				isSet: !!env.value,
			})),
			optional: ENV_VARS.optional.map((env) => ({
				key: env.key,
				isSet: !!env.value,
			})),
			forceFirstTimeSetup: dynamicEnv.FORCE_FIRST_TIME_SETUP === 'true',
		},
	};
};

export const actions: Actions = {
	setupAdmin: async ({ request }) => {
		try {
			const formData = await request.formData();
			const username = formData.get('username');
			const email = formData.get('email');
			const password = formData.get('password');
			const password_confirmation = formData.get('confirmPassword');

			// validate input
			const validationResult = signUpSchema.safeParse({
				username,
				email,
				password,
				password_confirmation,
			});

			if (!validationResult.success) {
				return fail(400, {
					errors: processZodErrors(validationResult.error),
					username: username as string,
					email: email as string,
				});
			}

			const data = validationResult.data;

			// check if passwords match
			if (data.password !== data.password_confirmation) {
				return fail(400, {
					errors: { confirmPassword: ['Passwords do not match'] },
					username: data.username,
					email: data.email,
				});
			}

			// check for blank email, if so, craft placeholder
			if (!data.email) {
				data.email = `${data.username}${USERNAME_PLACEHOLDER}`;
			}

			// create the admin user using better-auth
			const result = await auth.api.signUpEmail({
				body: {
					email: data.email,
					password: data.password,
					username: data.username,
					displayUsername: data.username,
					name: data.username,
					// @ts-expect-error - isAdminCreated isn't in the body, but im trying to pass it
					isAdminCreated: true,
				},
			});

			if (!result) {
				logger.error('Failed to create admin user - no result from auth.api.signUpEmail');
				return fail(500, {
					errors: { _form: ['Failed to create admin account. Please try again.'] },
					username: data.username,
					email: data.email,
				});
			}

			// set user role to admin
			const updateRoleResult = await updateUserRole(result.user.id, RoleNames.admin);

			if (!updateRoleResult) {
				logger.error('Failed to update admin user role');
				return fail(500, {
					errors: { _form: ['Failed to create admin account. Please try again.'] },
					username: data.username,
					email: data.email,
				});
			}

			// mark setup as completed
			await updateSettingByKey('firstTimeSetupCompleted', true);

			logger.info(`First-time setup completed. Admin user created: ${data.username}`);

			// create session for the new admin user
			const sessionResult = await auth.api.signInEmail({
				body: {
					email: data.email,
					password: data.password,
				},
			});

			if (!sessionResult) {
				logger.error('Failed to create session for admin user');
				// still mark as success since user was created, just redirect to signin
				throw redirect(303, '/signin');
			}

			// redirect to dashboard with the new session
			throw redirect(303, '/dashboard');
		} catch (error) {
			// if it's a redirect, re-throw it
			if (isRedirect(error)) {
				throw error;
			}

			logger.error(`Setup error: ${JSON.stringify(error)}`);

			return fail(500, {
				errors: { _form: ['An unexpected error occurred. Please try again.'] },
			});
		}
	},
};
