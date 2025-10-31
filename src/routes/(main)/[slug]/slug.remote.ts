import type { DBUser } from '$database/schema';
import { error } from '@sveltejs/kit';
import * as z from 'zod';
import { getRequestEvent, query } from '$app/server';
import { createChildLogger } from '$lib/server/logger';
import { PERMISSIONS, type Permission } from '$src/lib/auth/roles-shared';
import { requirePermission } from '$src/lib/server/auth';
import {
	canUserViewPaste,
	deletePaste,
	findPasteBySlug,
	getPasteInvitedUsers,
	incrementPasteViews,
} from '$src/lib/server/pastes';
import { type InvitedUser, PasteSlugSchema } from '$src/lib/shared/pastes';
import { isDBUser } from '$src/lib/utils/format';

const logger = createChildLogger('SlugRemote');

const GetPasteSchema = z.object({
	slug: PasteSlugSchema, // paste id or custom url
});

export const getPaste = query(GetPasteSchema, async ({ slug }) => {
	logger.debug(`getPaste called with slug: ${slug}`);

	// get the full request event context on the server
	const event = getRequestEvent();
	if (!event) {
		throw error(500, 'Request context not available');
	}

	const { getClientAddress, request, url, cookies, locals } = event;
	const user = (locals.user as DBUser | null) || null;
	const isAdmin = locals.isAdmin;

	// get user permissions
	let userPermissions: Permission[] = [];
	try {
		if (isDBUser(user)) {
			await requirePermission(user, {
				pastes: [PERMISSIONS.pastes['read:public']],
			});

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

	const paste = await findPasteBySlug(slug);
	if (!paste) {
		logger.warn(`Paste not found for slug: ${slug}`);
		throw error(404, 'Paste not found');
	}

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
			logger.warn(`Access denied for unauthenticated user on paste ${paste.id}`);
			throw error(401, 'Authentication required');
		} else {
			logger.warn(
				`Access denied for user ${user.id} on paste ${paste.id} (visibility: ${paste.visibility})`
			);
			throw error(403, 'Access denied');
		}
	}

	// check if paste requires password protection
	if (paste.passwordHash) {
		// skip password requirement if user is the owner
		const isOwner = user?.id === paste.owner_id;
		if (!isOwner && !isAdmin) {
			// return special flag indicating password is required
			return {
				paste: null,
				passwordRequired: true,
				canEdit: false,
				canDelete: false,
				isOwner: false,
				invitedUsers: [],
			};
		}
		logger.debug(`Password check bypassed for paste ${paste.id} - user is owner or admin`);
	}

	// burn-after-reading: allow same-session navigation (versions) without burning;
	// delete for subsequent users (no session cookie) if already viewed before
	if (paste.burnAfterReading && user?.id !== paste.owner_id) {
		const cookieName = `pv_${paste.id}`;
		const hasCookie = cookies.get(cookieName) === '1';

		if (paste.lastViewedAt && !hasCookie) {
			logger.info(`Burning paste ${paste.id} after reading`);
			await deletePaste(paste.id);
			throw error(404, 'Paste not found');
		}
		// mark this session as having access
		cookies.set(cookieName, '1', { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 10 });
	}

	// determine selected version from query param
	const versionParam = url.searchParams.get('version');
	let selectedVersion = versionParam ? parseInt(versionParam, 10) : null;

	logger.debug(`Version handling: requested=${versionParam}, parsed=${selectedVersion}`);

	// increment views only for latest (no version param)
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
	} else {
		logger.debug(
			`Skipping view increment for paste ${paste.id} - viewing version ${selectedVersion}`
		);
	}

	// get invited users if this is an INVITE_ONLY paste
	let invitedUsers: Array<InvitedUser> = [];

	if (paste.visibility === 'INVITE_ONLY') {
		invitedUsers = await getPasteInvitedUsers(paste.id);
	}

	// compute version visibility and metadata
	let canViewVersions = false;
	let versions: Array<{
		versionNumber: number;
		createdAt: Date;
		length: number;
		delta?: number;
	}> = [];
	let effectiveContent = paste.content;

	if (paste.versioningEnabled) {
		canViewVersions = paste.owner_id === user?.id || isAdmin || paste.versionHistoryVisible;

		if (canViewVersions) {
			const meta = await (await import('$lib/server/pastes')).listPasteVersionMeta(paste.id);
			const latestLen = paste.content.length;
			versions = meta.map((m) => ({ ...m, delta: latestLen - m.length }));
		}
		if (selectedVersion) {
			if (canViewVersions) {
				const verContent = await (
					await import('$lib/server/pastes')
				).getPasteVersionContent(paste.id, selectedVersion);
				if (verContent !== null) {
					effectiveContent = verContent;
				}

				if (selectedVersion > paste.currentVersion) {
					selectedVersion = paste.currentVersion;
					logger.warn(
						`Requested version ${versionParam} exceeds current version ${paste.currentVersion}, using current`
					);
				}
			} else {
				// cant view versions, so set selectedVersion to null
				selectedVersion = null;
			}
		}
	}

	// prepare paste data to return
	const pasteData = {
		paste: {
			id: paste.id,
			customSlug: paste.customSlug,
			content: effectiveContent,
			owner_id: paste.owner_id,
			ownerUsername: paste.ownerUsername,
			visibility: paste.visibility,
			language: paste.language || 'plaintext',
			title: paste.title,
			views: selectedVersion ? paste.views : paste.views + 1, // only increment on latest view
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
		canEdit: user?.id === paste.owner_id || isAdmin,
		canDelete: user?.id === paste.owner_id || isAdmin,
		isOwner: user?.id === paste.owner_id,
		invitedUsers,
		versions,
		canViewVersions,
		selectedVersion,
	};

	// if burnAfterReading is enabled, delete the paste after serving the data
	// but NOT if the current viewer is the paste owner
	if (paste.burnAfterReading && user?.id !== paste.owner_id) {
		logger.info(`Burning paste ${paste.id} after serving data`);
		await deletePaste(paste.id);
	}

	logger.debug(`getPaste completed successfully for slug: ${slug}`);
	return pasteData;
});
