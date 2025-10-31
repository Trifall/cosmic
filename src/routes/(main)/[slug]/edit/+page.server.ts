import type { DBUser } from '$database/schema';
import { actionRequirePermission, requirePermission } from '@/src/lib/server/auth';
import { createChildLogger } from '@/src/lib/server/logger';
import {
	canUserViewPaste,
	findPasteBySlug,
	getPasteInvitedUsers,
	isSlugAvailable,
	updatePaste,
} from '@/src/lib/server/pastes';
import { checkPasteRateLimit } from '@/src/lib/server/rate-limit';
import { getSetting } from '@/src/lib/server/settings';
import { type InvitedUser, UpdatePasteSchema } from '@/src/lib/shared/pastes';
import {
	calculateExpiresAt,
	formatPasteStatusError,
	isDBUser,
	isUnauthenticatedUser,
	processZodErrors,
} from '@/src/lib/utils/format';
import { error, fail, isActionFailure, isRedirect, redirect } from '@sveltejs/kit';
import { hashPassword } from 'better-auth/crypto';
import { PERMISSIONS, type Permission, RoleNames } from '$src/lib/auth/roles-shared';
import type { ExpiryEnumValue } from '$src/lib/shared/settings';
import type { Actions, PageServerLoad } from './$types';

const logger = createChildLogger('PasteSlugEdit');

export const load: PageServerLoad = async ({ params, parent }) => {
	try {
		const { user, isAdmin } = await parent();

		// must be authenticated to edit
		if (isUnauthenticatedUser(user)) {
			throw error(401, 'Authentication required');
		}

		// check basic read permissions
		await requirePermission(user, {
			pastes: [PERMISSIONS.pastes['read:public']],
		});

		const paste = await findPasteBySlug(params.slug);
		if (!paste) {
			throw error(404, 'Paste not found');
		}

		const userPermissions: Permission[] = [
			PERMISSIONS.pastes['read:public'] as Permission,
			PERMISSIONS.pastes['read:authenticated'] as Permission,
			PERMISSIONS.pastes['read:invited'] as Permission,
			PERMISSIONS.pastes['read:private'] as Permission,
		];

		if (isAdmin) {
			userPermissions.push(PERMISSIONS.pastes['read:any'] as Permission);
		}

		// check if user can view this paste
		const canView = await canUserViewPaste(
			{
				id: paste.id,
				owner_id: paste.owner_id,
				visibility: paste.visibility,
			},
			user,
			userPermissions
		);

		if (!canView) {
			throw error(403, 'Access denied');
		}

		// check if user can edit this paste (owner or admin)
		const canEdit = user.id === paste.owner_id || isAdmin;
		if (!canEdit) {
			throw error(403, 'You do not have permission to edit this paste');
		}

		// get invited users if this is an INVITE_ONLY paste
		let invitedUsers: Array<InvitedUser> = [];

		if (paste.visibility === 'INVITE_ONLY') {
			invitedUsers = await getPasteInvitedUsers(paste.id);
		}

		// fetch forced expiry settings for edit page
		const forceExpiryAuthed = await getSetting('forceExpiryAuthed');
		const forceExpiryAuthedValue = await getSetting('forceExpiryAuthedValue');
		const forceExpiryUnauthed = await getSetting('forceExpiryUnauthed');
		const forceExpiryUnauthedValue = await getSetting('forceExpiryUnauthedValue');

		// determine if forced expiry applies to this user (admins are exempt)
		let forceExpiry = false;
		let forceExpiryValue = '';
		let userType: 'authenticated' | 'unauthenticated' = 'authenticated';

		if (isDBUser(user) && user.role !== RoleNames.admin) {
			userType = 'authenticated';
			forceExpiry = forceExpiryAuthed;
			forceExpiryValue = forceExpiryAuthedValue;
		} else if (isUnauthenticatedUser(user)) {
			userType = 'unauthenticated';
			forceExpiry = forceExpiryUnauthed;
			forceExpiryValue = forceExpiryUnauthedValue;
		}

		// return paste data for editing
		return {
			paste: {
				id: paste.id,
				customSlug: paste.customSlug,
				content: paste.content,
				owner_id: paste.owner_id,
				ownerUsername: paste.ownerUsername,
				visibility: paste.visibility,
				language: paste.language || 'plaintext',
				title: paste.title,
				views: paste.views,
				uniqueViews: paste.uniqueViews,
				createdAt: paste.createdAt,
				updatedAt: paste.updatedAt,
				lastViewedAt: paste.lastViewedAt,
				currentVersion: paste.currentVersion,
				burnAfterReading: paste.burnAfterReading,
				expiresAt: paste.expiresAt,
				hasPassword: paste.passwordHash ? paste.passwordHash.length > 0 : false,
				versioningEnabled: paste.versioningEnabled,
				versionHistoryVisible: paste.versionHistoryVisible,
			},
			canEdit: true,
			isOwner: user.id === paste.owner_id,
			invitedUsers,
			forceExpiry,
			forceExpiryValue,
			userType,
		};
	} catch (err) {
		logger.error(`Error loading paste for editing: ${JSON.stringify(err)}`);
		const errFormatted = formatPasteStatusError(err);
		if (errFormatted instanceof Response) {
			throw errFormatted;
		}
		// redirect to custom error page with error message
		throw redirect(302, `/error?message=${encodeURIComponent(errFormatted.message)}`);
	}
};

export const actions: Actions = {
	updatePaste: async ({ request, params, locals }) => {
		const { user, isAdmin } = locals;

		if (isUnauthenticatedUser(user)) {
			throw error(401, 'Authentication required');
		}

		const res = isAdmin
			? user
			: await actionRequirePermission(request, {
					pastes: [PERMISSIONS.pastes['update:own']], // using create permission for now
				});

		if (!res || isActionFailure(res)) {
			return res;
		}

		const formData = await request.formData();

		// invited users
		const invitedUsers = formData
			.getAll('invitedUsers')
			.map((id) => id.toString())
			.filter(Boolean);

		// users to remove from invites
		const removedUsers = formData
			.getAll('removedUsers')
			.map((id) => id.toString())
			.filter(Boolean);

		// fetch forced expiry setting for validation
		const forceExpiryAuthed = await getSetting('forceExpiryAuthed');
		let forceExpiry = false;
		if (isDBUser(res) && (res as DBUser).role !== RoleNames.admin) {
			forceExpiry = forceExpiryAuthed;
		}

		// parse expiry and calculate expiresAt timestamp
		let expiryValue = formData.get('expiry')?.toString();
		let expiresAt: Date | null | undefined = undefined;
		let shouldUpdateExpiry = false;

		// if forced expiry is enabled, ignore user input and force no change
		if (forceExpiry) {
			expiryValue = '';
			shouldUpdateExpiry = false;
		} else {
			// only process expiry if it was actually submitted and not empty string
			// expiryValue will be undefined if field not submitted, or a string if submitted
			if (expiryValue !== undefined && expiryValue !== '') {
				shouldUpdateExpiry = true;
				expiresAt = calculateExpiresAt(expiryValue as ExpiryEnumValue);
			}
		}

		// build form values object with only provided fields
		const formValues: Record<string, unknown> = {};

		const content = formData.get('content')?.toString();
		if (content !== undefined) formValues.content = content;

		const visibility = formData.get('visibility')?.toString();
		if (visibility !== undefined) formValues.visibility = visibility;

		const customSlug = formData.get('customSlug')?.toString();
		if (customSlug !== undefined) formValues.customSlug = customSlug || undefined;

		const language = formData.get('language')?.toString();
		if (language !== undefined) formValues.language = language;

		const title = formData.get('title')?.toString();
		if (title !== undefined) formValues.title = title || undefined;

		const password = formData.get('password')?.toString();
		if (password !== undefined) formValues.password = password || undefined;
		const changePassword = formData.get('changePassword')?.toString() === 'true';

		// password logic:
		// - if changePassword is false: dont include password field (undefined = no change)
		// - if changePassword is true AND password is empty: set to null (remove password)
		// - if changePassword is true AND password has value: set password

		let passwordToUpdate: string | null | undefined = undefined;

		if (changePassword) {
			// user explicitly wants to change/remove password
			passwordToUpdate = password && password.trim() ? password : null;
		}

		if (passwordToUpdate !== undefined) {
			formValues.password = passwordToUpdate;
		}

		const burnAfterReadingValue = formData.get('burnAfterReading')?.toString();
		if (burnAfterReadingValue !== undefined)
			formValues.burnAfterReading = burnAfterReadingValue === 'true';

		const versioningEnabled = formData.get('versioningEnabled')?.toString();
		if (versioningEnabled !== undefined)
			formValues.versioningEnabled = versioningEnabled === 'true';

		const versionHistoryVisible = formData.get('versionHistoryVisible')?.toString();
		if (versionHistoryVisible !== undefined)
			formValues.versionHistoryVisible = versionHistoryVisible === 'true';

		if (invitedUsers.length > 0) formValues.invitedUsers = invitedUsers;
		if (removedUsers.length > 0) formValues.removedUsers = removedUsers;

		// only include expiresAt if expiry was explicitly set (not empty string)
		if (shouldUpdateExpiry) {
			formValues.expiresAt = expiresAt;
		} else {
			delete formValues.expiresAt;
		}

		const result = UpdatePasteSchema.safeParse(formValues);
		if (!result.success) {
			const fieldErrors = processZodErrors(result.error);
			return fail(400, {
				data: formValues,
				errors: {
					...fieldErrors,
					_form: [fieldErrors?.content ? fieldErrors.content : 'Please fix the errors in the form'],
				},
				message: 'Please fix the errors in the form',
			});
		}

		// must be valid user
		if (!isDBUser(res as DBUser)) {
			return fail(401, {
				data: formValues,
				errors: { _form: ['User not found'] },
				message: 'Authentication required',
			});
		}

		const userId = (res as DBUser).id;
		const userRole = (res as DBUser).role ?? undefined;

		// rate limiting check for authenticated users
		const rateLimitResult = await checkPasteRateLimit(userId, userRole);
		if (!rateLimitResult.allowed) {
			const retryAfterSeconds = Math.ceil((rateLimitResult.msBeforeNext || 60000) / 1000);
			return fail(429, {
				data: formValues,
				errors: {
					_form: [
						`Rate limit exceeded. Please try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`,
					],
				},
				message: `Rate limit exceeded. Please try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`,
			});
		}

		// get existing paste to verify ownership
		const existingPaste = await findPasteBySlug(params.slug);
		if (!existingPaste) {
			return fail(404, {
				data: formValues,
				errors: { _form: ['Paste not found'] },
				message: 'Paste not found',
			});
		}

		const canEdit = existingPaste.owner_id === userId || isAdmin;
		if (!canEdit) {
			return fail(403, {
				data: formValues,
				errors: { _form: ['You do not have permission to edit this paste'] },
				message: 'Access denied',
			});
		}

		// check size limit (400KB) if content is provided
		if (result.data.content && result.data.content.length > 400000) {
			return fail(413, {
				data: formValues,
				errors: { content: ['Content cannot exceed 400KB (400,000 bytes)'] },
				message: 'Payload too large',
			});
		}

		// validate custom slug if changed (slug availability will also be checked in updatePaste)
		if (result.data.customSlug && result.data.customSlug !== existingPaste.customSlug) {
			const slugAvailable = await isSlugAvailable(result.data.customSlug);
			if (!slugAvailable) {
				return fail(400, {
					data: formValues,
					errors: { customSlug: ['This URL is already taken'] },
					message: 'URL not available',
				});
			}
		}

		try {
			// hash password if provided
			let passwordHash: string | null | undefined = undefined;

			if (result.data.password !== undefined) {
				// Password field was included - either set new hash or set to null to remove
				if (result.data.password && result.data.password.trim()) {
					passwordHash = await hashPassword(result.data.password);
				} else {
					// Explicitly remove password
					passwordHash = null;
				}
			}

			// update paste with only provided fields
			// NOTE: only include expiresAt if explicitly changed by user
			await updatePaste({
				id: existingPaste.id,
				content: result.data.content,
				visibility: result.data.visibility,
				customSlug: result.data.customSlug,
				language: result.data.language,
				title: result.data.title,
				passwordHash,
				...(shouldUpdateExpiry && { expiresAt: expiresAt }),
				burnAfterReading: result.data.burnAfterReading,
				invitedUserIds: result.data.invitedUsers,
				removedUserIds: result.data.removedUsers,
				updatedBy: userId,
				changeDescription: 'Paste updated via web interface',
				versioningEnabled: result.data.versioningEnabled,
				versionHistoryVisible: result.data.versionHistoryVisible,
			});

			// determine the slug to redirect to (use custom slug if provided, otherwise use paste id)
			const redirectSlug =
				result.data.customSlug !== undefined
					? result.data.customSlug || existingPaste.id
					: existingPaste.customSlug || existingPaste.id;

			// redirect to updated paste
			throw redirect(303, `/${redirectSlug}`);
		} catch (error) {
			if (isRedirect(error)) {
				throw error; // re-throw redirects
			}

			logger.error(`Error updating paste: ${error}`);
			return fail(500, {
				data: formValues,
				errors: { _form: ['Failed to update paste'] },
				message: 'Server error',
			});
		}
	},
};
