import { getAuthUser, requirePermission } from '@/src/lib/server/auth';
import { createChildLogger } from '@/src/lib/server/logger';
import {
	canUserViewPaste,
	deletePaste,
	findPasteBySlug,
	incrementPasteViews,
	validatePastePassword,
} from '@/src/lib/server/pastes';
import { formatPasteStatusError, isDBUser } from '@/src/lib/utils/format';
import { error } from '@sveltejs/kit';
import { PERMISSIONS, type Permission, RoleNames } from '$src/lib/auth/roles-shared';
import { PasteSlugSchema } from '$src/lib/shared/pastes';
import type { RequestHandler } from './$types';

const logger = createChildLogger('PasteRawAPI');

export const GET: RequestHandler = async ({ params, request, getClientAddress, url, cookies }) => {
	if (!PasteSlugSchema.safeParse(params.slug).success) {
		throw error(404, 'Not found');
	}

	try {
		const authUser = await getAuthUser(request);

		let user = null;
		let isAdmin = false;

		if (authUser) {
			user = authUser;
			isAdmin = authUser.role === RoleNames.admin;
		}

		let userPermissions: Permission[] = [];
		try {
			if (isDBUser(user)) {
				await requirePermission(user, {
					pastes: [PERMISSIONS.pastes['read:public']],
				});
				// get all paste permissions for the user
				userPermissions = [
					PERMISSIONS.pastes['read:public'],
					PERMISSIONS.pastes['read:authenticated'],
					PERMISSIONS.pastes['read:invited'],
					PERMISSIONS.pastes['read:private'],
				];

				// add admin permissions if user is admin
				if (isAdmin) {
					userPermissions.push(PERMISSIONS.pastes['read:any']);
				}
			} else {
				// unauthenticated user - only public read permission
				await requirePermission(user, {
					pastes: [PERMISSIONS.pastes['read:public']],
				});
				userPermissions = [PERMISSIONS.pastes['read:public']];
			}
		} catch {
			throw error(403, 'Insufficient permissions');
		}

		// find the paste
		const paste = await findPasteBySlug(params.slug);
		if (!paste) {
			throw error(404, 'Paste not found');
		}

		// skip password requirement if user is the owner, or if valid password provided
		if (paste.passwordHash) {
			const isOwner = user?.id === paste.owner_id;

			if (!isOwner) {
				// check for password in URL parameter or header
				const passwordParam = url.searchParams.get('password');
				const passwordHeader = request.headers.get('x-paste-password');
				const providedPassword = passwordParam || passwordHeader;

				if (!providedPassword) {
					throw error(
						403,
						'Password required. Provide via ?password=xxx or X-Paste-Password header'
					);
				}

				const isValidPassword = await validatePastePassword(paste.id, providedPassword);
				if (!isValidPassword) {
					throw error(403, 'Invalid password');
				}
			}
		}

		// check if user can view this paste
		const canView = await canUserViewPaste(
			{
				id: paste.id,
				owner_id: paste.owner_id,
				visibility: paste.visibility,
			},
			user || null,
			userPermissions
		);

		if (!canView) {
			if (!user) {
				throw error(401, 'Authentication required');
			} else {
				throw error(403, 'Access denied');
			}
		}

		// version selection
		const versionParam = url.searchParams.get('version');
		const selectedVersion = versionParam ? parseInt(versionParam, 10) : null;

		// increment only on latest
		if (!selectedVersion) {
			const clientAddress = getClientAddress();
			const userAgent = request.headers.get('user-agent') || undefined;
			const referrer = request.headers.get('referer') || undefined;
			await incrementPasteViews(paste.id, {
				ip: clientAddress,
				userAgent,
				userId: user?.id,
				referrer,
			});
		}

		// determine content (version or latest)
		let effectiveContent = paste.content;
		if (selectedVersion && paste.versioningEnabled) {
			const { canViewVersionHistory, getPasteVersionContent } = await import('$lib/server/pastes');
			const canViewVersions = canViewVersionHistory(
				{
					owner_id: paste.owner_id,
					versioningEnabled: paste.versioningEnabled,
					versionHistoryVisible: paste.versionHistoryVisible,
				},
				user || null,
				userPermissions
			);
			if (canViewVersions) {
				const verContent = await getPasteVersionContent(paste.id, selectedVersion);
				if (verContent !== null) effectiveContent = verContent;
			}
		}

		// res obj with security headers
		const response = new Response(effectiveContent, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'X-Content-Type-Options': 'nosniff',
				'X-Frame-Options': 'DENY',
				'X-XSS-Protection': '1; mode=block',
			},
		});

		// if burnAfterReading is enabled, delete the paste after serving the content
		// but NOT if the current viewer is the paste owner
		if (paste.burnAfterReading && user?.id !== paste.owner_id) {
			const cookieName = `pv_${paste.id}`;
			const hasCookie = cookies.get(cookieName) === '1';
			if (paste.lastViewedAt && !hasCookie) {
				await deletePaste(paste.id);
			}
			cookies.set(cookieName, '1', { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 10 });
		}

		return response;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (err: any) {
		const errFormatted = formatPasteStatusError(err);
		logger.error(
			`Error loading paste: ${JSON.stringify(errFormatted ?? err?.body ?? err?.message ?? err, null, 2)}`
		);
		if (errFormatted instanceof Response) {
			throw errFormatted;
		}
		throw error(errFormatted.status, errFormatted.message);
	}
};
