import type { DBUser } from '$database/schema';
import { actionRequirePermission, requirePermission } from '@/src/lib/server/auth';
import { createChildLogger } from '@/src/lib/server/logger';
import {
	createPaste,
	generatePasteId,
	getForkPasteData,
	getUserPasteCount,
	isSlugAvailable,
} from '@/src/lib/server/pastes';
import { checkPasteRateLimit, checkUnauthenticatedRateLimit } from '@/src/lib/server/rate-limit';
import { getSetting } from '@/src/lib/server/settings';
import { CreatePasteSchema } from '@/src/lib/shared/pastes';
import {
	calculateExpiresAt,
	formatPasteStatusError,
	isDBUser,
	isUnauthenticatedUser,
	processZodErrors,
} from '@/src/lib/utils/format';
import { fail, isActionFailure, isRedirect, redirect } from '@sveltejs/kit';
import { hashPassword } from 'better-auth/crypto';
import { PERMISSIONS } from '$src/lib/auth/roles-shared';
import { RoleNames } from '$src/lib/auth/roles-shared';
import { type ExpiryEnumValue, SETTINGS_CONFIG } from '$src/lib/shared/settings';
import type { Actions, PageData, PageServerLoad } from './$types';

const logger = createChildLogger('MainPage');

export const load: PageServerLoad = async ({
	parent,
	url,
}: {
	parent: () => Promise<{ user: DBUser | null; isAdmin: boolean }>;
	url: URL;
}): Promise<PageData> => {
	try {
		const { user, isAdmin = false } = await parent();

		if (user?.banned) {
			throw redirect(302, `/error?banned=true`);
		}

		// fetch forced expiry settings
		const forceExpiryAuthed = await getSetting('forceExpiryAuthed');
		const forceExpiryAuthedValue = await getSetting('forceExpiryAuthedValue');
		const forceExpiryUnauthed = await getSetting('forceExpiryUnauthed');
		const forceExpiryUnauthedValue = await getSetting('forceExpiryUnauthedValue');

		// determine if forced expiry applies to this user
		let forceExpiry = false;
		let forceExpiryValue = '';

		if (isUnauthenticatedUser(user)) {
			forceExpiry = forceExpiryUnauthed;
			forceExpiryValue = forceExpiryUnauthedValue;
		} else if (isDBUser(user) && user.role !== RoleNames.admin) {
			forceExpiry = forceExpiryAuthed;
			forceExpiryValue = forceExpiryAuthedValue;
		}

		// check if unauthenticated paste creation is enabled
		const unauthPasteCreationEnabled = await getSetting('enableUnauthenticatedPasteCreation');

		if (isUnauthenticatedUser(user) && !unauthPasteCreationEnabled) {
			return {
				user: null,
				isAdmin: false,
				canCreatePastes: false,
				currentPasteCount: 0,
				maxPastesPerUser: 0,
				forkedPasteData: null,
				forceExpiry: forceExpiry,
				forceExpiryValue: forceExpiryValue,
			};
		}

		await requirePermission(user, {
			pastes: [PERMISSIONS.pastes['read:public']],
		});

		let canCreatePastes = false;
		let currentPasteCount = 0;

		if (isUnauthenticatedUser(user)) {
			canCreatePastes = unauthPasteCreationEnabled;
		} else {
			// user is authenticated
			try {
				await requirePermission(user, {
					pastes: [PERMISSIONS.pastes.create],
				});
				canCreatePastes = true;
				currentPasteCount = await getUserPasteCount(user.id);
			} catch {
				canCreatePastes = false;
			}
		}

		const maxPastesPerUser = await getSetting('maxPastesPerUser');
		if (!maxPastesPerUser) {
			logger.warn('maxPastesPerUser setting not found, defaulting to 1000');
		}

		// handle fork paste data fetching
		const forkedFromId = url.searchParams.get('forkedFrom');
		const versionParam = url.searchParams.get('version');
		let forkedPasteData = null;

		if (forkedFromId) {
			const forkResult = await getForkPasteData(forkedFromId, user, isAdmin, versionParam);

			if (!forkResult.success) {
				return {
					user,
					isAdmin,
					canCreatePastes,
					currentPasteCount,
					maxPastesPerUser: maxPastesPerUser ?? SETTINGS_CONFIG.maxPastesPerUser.defaultValue,
					forkError: forkResult.error,
					forceExpiry,
					forceExpiryValue,
				};
			}

			forkedPasteData = forkResult.data;

			logger.debug(`Forked paste data: ${JSON.stringify(forkedPasteData, null, 2)}`);
		}

		return {
			user,
			isAdmin,
			canCreatePastes,
			currentPasteCount,
			maxPastesPerUser: maxPastesPerUser ?? SETTINGS_CONFIG.maxPastesPerUser.defaultValue,
			forkedPasteData,
			forceExpiry,
			forceExpiryValue,
		};
	} catch (error) {
		logger.error(`Error in page server load: ${formatPasteStatusError(error)}`);
		return {
			user: null,
			isAdmin: false,
			canCreatePastes: false,
			currentPasteCount: 0,
			maxPastesPerUser: 0,
			forkedPasteData: null,
			error: 'Failed to load page data',
			forceExpiry: false,
			forceExpiryValue: '',
		};
	}
};

export const actions: Actions = {
	createPaste: async ({ request, getClientAddress }) => {
		const formData = await request.formData();
		const clientIp = getClientAddress();
		const userAgent = request.headers.get('user-agent') || 'unknown';

		// check if user is authenticated
		const res = await actionRequirePermission(request, {
			pastes: [PERMISSIONS.pastes.create],
		});

		const isAuthenticated = res && !isActionFailure(res) && isDBUser(res as DBUser);
		let user: DBUser | null = null;
		let userId: string | null = null;
		let userRole: string | undefined = undefined;

		if (isAuthenticated) {
			user = res as DBUser;
			userId = user.id;
			userRole = user.role ?? undefined;
		}

		// if not authenticated, check if unauthenticated paste creation is enabled
		if (!isAuthenticated) {
			const unauthPasteCreationEnabled = await getSetting('enableUnauthenticatedPasteCreation');
			if (!unauthPasteCreationEnabled) {
				return fail(401, {
					data: {},
					errors: { _form: ['You must be logged in to create pastes'] },
					message: 'Authentication required',
				});
			}

			// check unauthenticated rate limits
			const unauthRateLimitResult = await checkUnauthenticatedRateLimit(clientIp, userAgent);
			if (!unauthRateLimitResult.allowed) {
				const retryAfterSeconds = Math.ceil((unauthRateLimitResult.msBeforeNext || 60000) / 1000);
				return fail(429, {
					data: {},
					errors: {
						_form: [
							`Too many requests (Rate Limit Exceeded). Please try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`,
						],
					},
					message: `Too many requests (Rate Limit Exceeded)`,
				});
			}
		}

		// invited users
		const invitedUsers = formData
			.getAll('invitedUsers')
			.map((id) => id.toString())
			.filter(Boolean);

		// fetch forced expiry settings for validation
		const forceExpiryAuthed = await getSetting('forceExpiryAuthed');
		const forceExpiryAuthedValue = await getSetting('forceExpiryAuthedValue');
		const forceExpiryUnauthed = await getSetting('forceExpiryUnauthed');
		const forceExpiryUnauthedValue = await getSetting('forceExpiryUnauthedValue');

		// determine if forced expiry applies to this user
		let forceExpiry = false;
		let forceExpiryValue = '';
		if (isUnauthenticatedUser(user)) {
			forceExpiry = forceExpiryUnauthed;
			forceExpiryValue = forceExpiryUnauthedValue;
		} else if (isDBUser(user) && user.role !== RoleNames.admin) {
			forceExpiry = forceExpiryAuthed;
			forceExpiryValue = forceExpiryAuthedValue;
		}

		// parse expiry and calculate expiresAt timestamp
		let expiryValue = formData.get('expiry')?.toString();
		let expiresAt: Date | null | undefined = undefined;

		// override with forced expiry if applicable
		if (forceExpiry) {
			expiryValue = forceExpiryValue;
		}

		if (expiryValue) {
			expiresAt = calculateExpiresAt(expiryValue as ExpiryEnumValue);
		}

		const formValues = {
			content: formData.get('content')?.toString() || '',
			visibility: formData.get('visibility')?.toString() || 'PUBLIC',
			customSlug: formData.get('customSlug')?.toString() || undefined,
			language: formData.get('language')?.toString() || 'plaintext',
			title: formData.get('title')?.toString() || undefined,
			password: formData.get('password')?.toString() || undefined,
			burnAfterReading: formData.get('burnAfterReading') === 'true',
			invitedUsers: invitedUsers,
			expiresAt,
			// versioning flags
			versioningEnabled: formData.get('versioningEnabled') === 'true',
			versionHistoryVisible: formData.get('versionHistoryVisible') === 'true',
		};

		const result = CreatePasteSchema.safeParse(formValues);
		if (!result.success) {
			const fieldErrors = processZodErrors(result.error);
			return fail(400, {
				data: formValues,
				errors: {
					...fieldErrors,
					_form: [
						fieldErrors?.content ? `${fieldErrors.content}` : 'Please fix the errors in the form',
					],
				},
				message: 'Please fix the errors in the form',
			});
		}

		// for authenticated users, check paste limits and rate limits
		if (isAuthenticated && userId) {
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

			// paste limit
			const currentCount = await getUserPasteCount(userId);
			const maxPastes = await getSetting('maxPastesPerUser');
			if (currentCount >= maxPastes) {
				return fail(400, {
					data: formValues,
					errors: { _form: [`You have reached the maximum limit of ${maxPastes} pastes`] },
					message: 'Paste limit exceeded',
				});
			}
		}

		// for unauthenticated users, restrict visibility to PUBLIC only
		if (!isAuthenticated && result.data.visibility !== 'PUBLIC') {
			return fail(400, {
				data: formValues,
				errors: {
					visibility: ['Unauthenticated users can only create PUBLIC pastes'],
				},
				message: 'Invalid visibility for unauthenticated user',
			});
		}

		// check size limit (400KB)
		if (result.data.content.length > 400000) {
			return fail(413, {
				data: formValues,
				errors: { content: ['Content cannot exceed 400KB (400,000 bytes)'] },
				message: 'Payload too large',
			});
		}

		// validate custom slug
		if (result.data.customSlug) {
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
			// generate paste ID
			let pasteId: string;
			let attempts = 0;
			const maxAttempts = 10;

			do {
				pasteId = generatePasteId();
				attempts++;
			} while (!(await isSlugAvailable(pasteId)) && attempts < maxAttempts);

			if (attempts >= maxAttempts) {
				logger.error(`Failed to generate unique paste ID after ${maxAttempts} attempts`);
				return fail(500, {
					data: formValues,
					message: 'Server error',
				});
			}

			// hash password if provided
			let passwordHash: string | undefined;
			if (result.data.password && result.data.password.trim()) {
				passwordHash = await hashPassword(result.data.password);
			}

			await createPaste({
				id: pasteId,
				content: result.data.content,
				owner_id: userId, // null for unauthenticated users
				visibility: result.data.visibility,
				customSlug: result.data.customSlug,
				language: result.data.language,
				title: result.data.title,
				passwordHash,
				expiresAt: result.data.expiresAt ?? undefined,
				burnAfterReading: result.data.burnAfterReading,
				invitedUserIds: result.data.invitedUsers,
				versioningEnabled: result.data.versioningEnabled,
				versionHistoryVisible: result.data.versionHistoryVisible,
			});

			// redirect to new paste
			throw redirect(303, `/${result.data.customSlug || pasteId}`);
		} catch (error) {
			if (isRedirect(error)) {
				throw error; // re-throw redirects
			}

			logger.error(`Error creating paste: ${error}`);
			return fail(500, {
				data: formValues,
				errors: { _form: ['Failed to create paste'] },
				message: 'Server error',
			});
		}
	},
};
