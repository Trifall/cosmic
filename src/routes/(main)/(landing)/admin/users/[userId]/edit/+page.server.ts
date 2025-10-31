import type { DBUser } from '$database/schema';
import {
	type EditUserFormData,
	EditUserFormSchema,
	USERNAME_PLACEHOLDER,
} from '@/src/lib/auth/user-management';
import { isDBUser, processZodErrors } from '@/src/lib/utils/format';
import { fail, isActionFailure } from '@sveltejs/kit';
import { actionRequirePermission } from '$lib/server/auth';
import { getUserDetailsById, updateUser } from '$lib/server/users';
import { AuthedRoleNames, PERMISSIONS, RoleNames } from '$src/lib/auth/roles-shared';
import { createChildLogger } from '$src/lib/server/logger';
import type { Actions, PageServerLoad } from './$types';

const logger = createChildLogger('userIdSlug/edit');

export const load: PageServerLoad = async ({ parent, params }) => {
	const { user: currentUser } = await parent();
	const userId = params.userId;

	// get user details
	const userResult = await getUserDetailsById(currentUser, userId);
	if (!userResult.ok) {
		return {
			user: null,
			roles: [],
			error: 'Failed to fetch user details',
		};
	}

	// get all roles for the dropdown
	if (!RoleNames) {
		return {
			user: userResult.value,
			roles: [],
			error: 'Failed to fetch roles',
		};
	}

	return {
		user: userResult.value,
		roles: AuthedRoleNames,
		error: null,
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const res = await actionRequirePermission(request, { user: [PERMISSIONS.user.update] });

		if (!res || isActionFailure(res)) {
			return res;
		}

		const userId = params.userId;
		const formData = await request.formData();
		const formValues = {
			username: formData.get('username')?.toString() || '',
			email: formData.get('email')?.toString() || null,
			role: formData.get('role')?.toString() || '',
			banned: formData.get('banned') === 'on',
			banReason: formData.get('banReason')?.toString() || '',
			newPassword: formData.get('newPassword')?.toString() || '',
		};

		logger.info(`Form values: ${JSON.stringify(formValues, null, 2)}`);

		const result = EditUserFormSchema.safeParse(formValues);
		if (!result.success) {
			logger.error(`Failed to parse form values: ${result.error}`);
			const errors = processZodErrors(result.error);
			logger.error(`Errors: ${errors}`);
			return fail(400, {
				data: formValues,
				errors: errors,
				message: 'Please fix the errors in the form',
			});
		}

		if (isDBUser(res as DBUser)) {
			const updateData = {
				username: result.data.username,
				email: result.data.email || result.data.username + USERNAME_PLACEHOLDER,
				role: result.data.role,
				banned: result.data.banned,
				banReason: result.data.banReason,
				newPassword: result.data.newPassword,
			} as EditUserFormData;

			logger.info(`Update data: ${JSON.stringify(updateData, null, 2)}`);

			const updateResult = await updateUser(res as DBUser, userId, updateData);

			if (!updateResult.ok) {
				logger.error(`Failed to update user: ${updateResult.error}`);
				return fail(400, {
					data: formValues,
					errors: {
						_form: [updateResult.error.message],
					},
					message: 'Failed to update user',
				});
			}

			// return success data instead of redirecting
			return { success: true, message: 'User updated successfully' };
		}

		return fail(500, {
			error: 'Internal server error',
		});
	},
};
