import { pasteInvites, pasteVersions, pasteViews, pastes } from '@/database/schema';
import { inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createChildLogger } from '$lib/server/logger';

const logger = createChildLogger('PasteCleanupHandler');

/**
 * Delete expired pastes from the database
 * This removes pastes where expiresAt is set and is in the past
 */
export const deleteExpiredPastes = async (): Promise<{
	deletedCount: number;
	errors: string[];
}> => {
	const errors: string[] = [];

	try {
		logger.debug('Starting expired paste cleanup...');

		// Find all expired pastes
		const expiredPastes = await db
			.select({
				id: pastes.id,
				title: pastes.title,
				expiresAt: pastes.expiresAt,
			})
			.from(pastes)
			.where(sql`${pastes.expiresAt} IS NOT NULL AND ${pastes.expiresAt} < NOW()`);

		if (expiredPastes.length === 0) {
			logger.debug('No expired pastes detected, no cleanup needed.');
			return { deletedCount: 0, errors: [] };
		}

		logger.debug(`Found ${expiredPastes.length} expired pastes to delete`);

		let deletedCount = 0;

		logger.debug(`Expired Pastes: ${JSON.stringify(expiredPastes, null, 2)}`);

		// Delete pastes in batches to avoid transaction size limits
		const batchSize = 100;
		for (let i = 0; i < expiredPastes.length; i += batchSize) {
			const batch = expiredPastes.slice(i, i + batchSize);
			const batchIds = batch.map((p) => p.id);

			try {
				await db.transaction(async (tx) => {
					// delete paste views first (foreign key constraint)
					await tx.delete(pasteViews).where(inArray(pasteViews.pasteId, batchIds));

					// delete paste versions
					await tx.delete(pasteVersions).where(inArray(pasteVersions.pasteId, batchIds));

					// delete paste invites
					await tx.delete(pasteInvites).where(inArray(pasteInvites.pasteId, batchIds));

					// finally delete the pastes themselves
					await tx.delete(pastes).where(inArray(pastes.id, batchIds));

					// increment by actual batch size since all deletes in transaction succeeded
					deletedCount += batch.length;
				});

				logger.debug(`Deleted batch of ${batch.length} expired pastes`);
			} catch (error) {
				const errorMsg = `Failed to delete batch of expired pastes: ${error}`;
				logger.error(errorMsg);
				errors.push(errorMsg);
			}
		}

		logger.debug(`Expired paste cleanup completed. Deleted ${deletedCount} pastes`);
		return { deletedCount, errors };
	} catch (error) {
		const errorMsg = `Failed to run expired paste cleanup: ${error}`;
		logger.error(errorMsg);
		errors.push(errorMsg);
		return { deletedCount: 0, errors };
	}
};
