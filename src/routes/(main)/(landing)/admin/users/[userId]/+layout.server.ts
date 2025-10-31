import { error } from '@sveltejs/kit';
import * as z from 'zod';
import type { LayoutServerLoad } from './$types';

const idSchema = z
	.string()
	.length(32)
	.regex(/^[A-Za-z0-9]+$/);

export const load: LayoutServerLoad = async ({ params }) => {
	const { userId } = params;
	if (!idSchema.safeParse(userId).success) {
		throw error(404, 'Invalid user ID');
	}
};
