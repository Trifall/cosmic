import { json } from '@sveltejs/kit';
import { validateS3Configuration } from '$lib/server/backups/s3-uploader';
import type { RequestHandler } from './$types';

/**
 * GET endpoint to test S3 configuration
 * Only accessible by authenticated admin users
 */
export const GET: RequestHandler = async ({ locals }) => {
	// check if user is admin
	if (!locals.isAdmin) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const validationResult = await validateS3Configuration();

		return json({
			success: true,
			configured: validationResult.valid,
			error: validationResult.error || null,
			message: validationResult.valid
				? 'S3 configuration is valid and ready for use'
				: `S3 configuration issue: ${validationResult.error}`,
		});
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';

		return json(
			{
				success: false,
				configured: false,
				error: errorMessage,
				message: `Failed to validate S3 configuration: ${errorMessage}`,
			},
			{ status: 500 }
		);
	}
};
