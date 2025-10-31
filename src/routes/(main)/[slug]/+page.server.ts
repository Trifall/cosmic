import type { DBUser } from '$database/schema';
import {
	deletePaste,
	findPasteBySlug,
	getPasteInvitedUsers,
	incrementPasteViews,
	validatePastePassword,
} from '@/src/lib/server/pastes';
import { fail, redirect } from '@sveltejs/kit';
import { createChildLogger } from '$lib/server/logger';
import { type InvitedUser } from '$lib/shared/pastes';
import { formatPasteStatusError, isUnauthenticatedUser } from '$lib/utils/format';
import { getSetting } from '$src/lib/server/settings';
import { getPaste } from '$src/routes/(main)/[slug]/slug.remote';
import type { Actions, PageServerLoad } from './$types';

const logger = createChildLogger('PasteSlugPage');

export const load: PageServerLoad = async ({ parent, params }) => {
	const { user } = await parent();
	try {
		const pasteData = await getPaste({
			slug: params.slug,
		});

		// see if unauthed paste creation is enabled
		const unauthPasteCreationEnabled = await getSetting('enableUnauthenticatedPasteCreation');

		const canCreatePastes = unauthPasteCreationEnabled || !isUnauthenticatedUser(user);

		const resData = { ...pasteData, canCreatePastes };

		return resData;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (err: any) {
		const errFormatted = formatPasteStatusError(err);
		logger.error(
			`Error loading paste with slug '${params.slug}': ${JSON.stringify(errFormatted ?? err?.body ?? err?.message ?? err)}`
		);
		if (errFormatted instanceof Response) {
			throw errFormatted;
		}

		// redirect to custom error page with error message
		throw redirect(302, `/error?message=${encodeURIComponent(errFormatted.message)}`);
	}
};

export const actions: Actions = {
	validatePassword: async ({ request, params, getClientAddress, locals }) => {
		const {
			user,
			isAdmin,
		}: {
			user: DBUser | null;
			isAdmin: boolean;
		} = locals;
		const formData = await request.formData();
		const password = formData.get('password')?.toString();

		if (!password) {
			return fail(400, {
				error: 'Password is required',
			});
		}

		try {
			// find the paste to check if it has a password
			const paste = await findPasteBySlug(params.slug);
			if (!paste) {
				return fail(404, {
					error: 'Paste not found',
				});
			}

			if (!paste.passwordHash) {
				return fail(400, {
					error: 'This paste does not require a password',
				});
			}

			const isValid = await validatePastePassword(paste.id, password);

			if (isValid) {
				// password is correct - return the paste data directly

				// increment view count
				const clientAddress = getClientAddress();
				await incrementPasteViews(paste.id, {
					ip: clientAddress,
					userId: user?.id,
				});

				// get invited users if this is an INVITE_ONLY paste
				let invitedUsers: Array<InvitedUser> = [];
				if (paste.visibility === 'INVITE_ONLY') {
					invitedUsers = await getPasteInvitedUsers(paste.id);
				}

				const data = {
					paste: {
						id: paste.id,
						customSlug: paste.customSlug,
						content: paste.content,
						owner_id: paste.owner_id,
						ownerUsername: paste.ownerUsername,
						visibility: paste.visibility,
						language: paste.language || 'plaintext',
						title: paste.title,
						views: paste.views + 1,
						uniqueViews: paste.uniqueViews,
						createdAt: paste.createdAt,
						updatedAt: paste.updatedAt,
						lastViewedAt: paste.lastViewedAt,
						currentVersion: paste.currentVersion,
						burnAfterReading: paste.burnAfterReading,
					},
					canEdit: user?.id === paste.owner_id || isAdmin,
					canDelete: user?.id === paste.owner_id || isAdmin,
					isOwner: user?.id === paste.owner_id,
					invitedUsers,
					passwordRequired: false,
				};

				// if burnAfterReading is enabled, delete the paste after serving the data
				// but NOT if the current viewer is the paste owner
				if (paste.burnAfterReading && user?.id !== paste.owner_id) {
					await deletePaste(paste.id);
				}

				return data;
			} else {
				return fail(400, {
					error: 'Invalid password',
				});
			}
		} catch (err) {
			logger.error(`Error validating password: ${err}`);
			return fail(500, {
				error: 'Server error',
			});
		}
	},
};
