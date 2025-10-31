import { redirect } from '@sveltejs/kit';
import { ROUTES } from '$src/lib/routes';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const { user } = await parent();

	if (!user) {
		redirect(302, ROUTES.AUTH.SIGNIN);
	}
};
