import { error } from '@sveltejs/kit';
import { PasteSlugSchema } from '$src/lib/shared/pastes';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	if (!PasteSlugSchema.safeParse(params.slug).success) {
		throw error(404, 'Not found');
	}
};
