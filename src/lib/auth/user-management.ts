import * as z from 'zod';
import { secureEmail, securePasswordSignUp, secureUsername } from '$lib/shared/auth';
import { authedRoleSchema } from '$src/lib/auth/roles-shared';

/**
 * Schema for adding a new user
 * Used for validating form data when creating a new user
 */
export const AddUserFormSchema = z.object({
	username: secureUsername,
	email: secureEmail,
	password: securePasswordSignUp,
	role: authedRoleSchema,
});

/**
 * Schema for editing an existing user
 * Used for validating form data when updating user details
 * Note: Password changes are handled separately for security
 */
export const EditUserFormSchema = z
	.object({
		username: secureUsername,
		email: secureEmail.or(z.literal('')).or(z.undefined()).or(z.null()),
		role: authedRoleSchema,
		banned: z.boolean(),
		banReason: z.string().optional(),
		newPassword: securePasswordSignUp.or(z.literal('')).or(z.undefined()).or(z.null()),
	})
	.superRefine((data, ctx) => {
		// validate password only if provided and not empty
		if (data.newPassword && data.newPassword.length > 0) {
			const result = securePasswordSignUp.safeParse(data.newPassword);
			if (!result.success) {
				// add all password validation errors
				result.error.issues.forEach((issue) => {
					ctx.addIssue({
						code: 'custom',
						message: issue.message,
						path: ['newPassword'],
					});
				});
			}
		}
	});

/**
 * Schema for adding a new role
 * Used for validating form data when creating a new role
 */
export const AddRoleFormSchema = z.object({
	name: z
		.string()
		.min(2, 'Role name must be at least 2 characters')
		.max(50, 'Role name cannot exceed 50 characters'),
	description: z
		.string()
		.max(200, 'Description cannot exceed 200 characters')
		.optional()
		.nullable(),
	permissionIds: z.array(z.string().or(z.number()).pipe(z.coerce.number())),
});

/**
 * Schema for editing an existing role
 * Used for validating form data when updating role details
 */
export const EditRoleFormSchema = z.object({
	name: z
		.string()
		.min(2, 'Role name must be at least 2 characters')
		.max(50, 'Role name cannot exceed 50 characters'),
	description: z
		.string()
		.max(200, 'Description cannot exceed 200 characters')
		.optional()
		.nullable(),
	permissionIds: z.array(z.string().or(z.number()).pipe(z.coerce.number())),
});

// type inference from schemas
export type AddUserFormData = z.infer<typeof AddUserFormSchema>;
export type EditUserFormData = z.infer<typeof EditUserFormSchema>;
export type AddRoleFormData = z.infer<typeof AddRoleFormSchema>;
export type EditRoleFormData = z.infer<typeof EditRoleFormSchema>;

export const USERNAME_PLACEHOLDER = '@username.placeholder';
