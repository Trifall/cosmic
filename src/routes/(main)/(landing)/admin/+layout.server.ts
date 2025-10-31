import { redirect } from '@sveltejs/kit';
import { isUnauthenticatedUser } from '$src/lib/utils/format';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const { user, isAdmin } = await parent();

	if (isUnauthenticatedUser(user) || !isAdmin) {
		redirect(
			302,
			`/error?error=${encodeURIComponent('You do not have permission to view this page')}`
		);
	}

	return {
		user,
	};
};
