import type { DBUser } from '$database/schema';
import { USERNAME_PLACEHOLDER } from '@/src/lib/auth/user-management';
import { createUser } from '@/src/lib/server/users';
import { isDBUser, processZodErrors } from '@/src/lib/utils/format';
import { fail, isActionFailure } from '@sveltejs/kit';
import * as z from 'zod';
import { actionRequirePermission } from '$lib/server/auth';
import { type AuthedRoleName, AuthedRoleNames, PERMISSIONS } from '$src/lib/auth/roles-shared';
import type { Actions, PageServerLoad } from './$types';

// schema for add user form validation
const AddUserFormSchema = z.object({
	username: z.string().min(3, 'Username must be at least 3 characters'),
	email: z.union([z.email('Please enter a valid email address'), z.string().nullish()]),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	role: z.string(),
});

export const load: PageServerLoad = async ({ parent }) => {
	// get the user from the parent layout
	const { user: currentUser } = await parent();

	// get all roles for the dropdown
	const rolesResult = AuthedRoleNames;
	if (!rolesResult) {
		return {
			user: currentUser,
			roles: [],
			error: 'Failed to fetch roles',
		};
	}

	return {
		user: currentUser,
		roles: rolesResult,
		error: null,
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const res = await actionRequirePermission(request, { user: [PERMISSIONS.user.create] });

		if (!res || isActionFailure(res)) {
			return res;
		}

		const formData = await request.formData();
		const formValues = {
			username: formData.get('username')?.toString() || '',
			email: formData.get('email')?.toString() || null,
			password: formData.get('password')?.toString() || '',
			role: formData.get('role')?.toString() || '',
		};

		const result = AddUserFormSchema.safeParse(formValues);
		if (!result.success) {
			return fail(400, {
				data: formValues,
				errors: processZodErrors(result.error),
				message: 'Please fix the errors in the form',
			});
		}

		if (isDBUser(res as DBUser)) {
			const createResult = await createUser(res as DBUser, {
				username: result.data.username,
				email: result.data.email || result.data.username + USERNAME_PLACEHOLDER,
				password: result.data.password,
				role: result.data.role as AuthedRoleName,
			});

			if (!createResult.ok) {
				return fail(400, {
					data: formValues,
					errors: [createResult.error.message],
					message: 'Failed to create user',
				});
			}

			// return success data instead of redirecting
			return { success: true, message: 'User created successfully' };
		}

		return fail(500, {
			error: 'Internal server error',
		});
	},
};
