import { getSetting, updateSettings } from '@/src/lib/server/settings';
import { fail } from '@sveltejs/kit';
import { BackupScheduler } from '$lib/server/backups/backup-scheduler';
import { isR2UploadConfigured } from '$lib/server/backups/r2-uploader';
import { isS3UploadConfigured } from '$lib/server/backups/s3-uploader';
import { createChildLogger } from '$lib/server/logger';
import { reloadRateLimiter } from '$lib/server/rate-limit';
import {
	type AllSettings,
	type ExpiryEnumValue,
	allSettingsSchema,
} from '$src/lib/shared/settings';
import type { Actions } from './$types';

const logger = createChildLogger('Settings');

export const actions = {
	updateSettings: async ({ request }) => {
		const formData = await request.formData();

		// preserve firstTimeSetupCompleted value - it should never be changed from admin settings
		const currentSetupCompleted = await getSetting('firstTimeSetupCompleted');

		// check S3 and R2 configuration status
		const s3Configured = isS3UploadConfigured();
		const r2Configured = isR2UploadConfigured();

		// get form values
		const s3BackupEnabledFormValue = formData.get('s3BackupEnabled') === 'true';
		const r2BackupEnabledFormValue = formData.get('r2BackupEnabled') === 'true';

		// enforce configuration requirements - disable if not configured
		const s3BackupEnabled = s3Configured ? s3BackupEnabledFormValue : false;
		const r2BackupEnabled = r2Configured ? r2BackupEnabledFormValue : false;

		// log warning if user tried to enable without configuration
		if (s3BackupEnabledFormValue && !s3Configured) {
			logger.warn('Attempted to enable S3 backups without proper configuration');
		}
		if (r2BackupEnabledFormValue && !r2Configured) {
			logger.warn('Attempted to enable R2 backups without proper configuration');
		}

		const data = {
			firstTimeSetupCompleted: currentSetupCompleted,
			// system settings
			publicRegistration: formData.get('publicRegistration') === 'true',
			maxPastesPerUser: Number(formData.get('maxPastesPerUser') || '0'),
			enableFullTextSearch: formData.get('enableFullTextSearch') === 'true',
			searchResultsLimit: Number(formData.get('searchResultsLimit') || '0'),
			enableUnauthenticatedPasteCreation:
				formData.get('enableUnauthenticatedPasteCreation') === 'true',

			// backup settings
			filesystemBackupEnabled: formData.get('filesystemBackupEnabled') === 'true',
			s3BackupEnabled,
			r2BackupEnabled,
			backupCronPattern: (formData.get('backupCronPattern') || '') as string,
			backupRetentionDays: Number(formData.get('backupRetentionDays') || '30'),
			enableAutoZip: formData.get('enableAutoZip') === 'true',

			// rate limiting settings
			rateLimitingAuthedEnabled: formData.get('rateLimitingAuthedEnabled') === 'true',
			rateLimitingAuthedLimit: Number(formData.get('rateLimitingAuthedLimit') || '10'),
			rateLimitingUnauthenticatedEnabled:
				formData.get('rateLimitingUnauthenticatedEnabled') === 'true',
			rateLimitingUnauthenticatedLimit: Number(
				formData.get('rateLimitingUnauthenticatedLimit') || '3'
			),
			rateLimitingUnauthenticatedGlobalEnabled:
				formData.get('rateLimitingUnauthenticatedGlobalEnabled') === 'true',
			rateLimitingUnauthenticatedGlobalLimit: Number(
				formData.get('rateLimitingUnauthenticatedGlobalLimit') || '20'
			),

			// expiry settings
			forceExpiryAuthed: formData.get('forceExpiryAuthed') === 'true',
			forceExpiryAuthedValue: (formData.get('forceExpiryAuthedValue') || '1w') as ExpiryEnumValue,
			forceExpiryUnauthed: formData.get('forceExpiryUnauthed') === 'true',
			forceExpiryUnauthedValue: (formData.get('forceExpiryUnauthedValue') ||
				'1d') as ExpiryEnumValue,
		} satisfies AllSettings;

		try {
			const validatedData = allSettingsSchema.parse(data);

			logger.debug(`Updating settings: ${JSON.stringify(validatedData, null, 2)}`);

			await updateSettings(validatedData);

			// restart backup scheduler if backup settings were changed
			try {
				const backupScheduler = BackupScheduler.getInstance();
				await backupScheduler.updateSchedule(
					validatedData.filesystemBackupEnabled,
					validatedData.s3BackupEnabled,
					validatedData.r2BackupEnabled,
					validatedData.backupCronPattern
				);
			} catch (error) {
				logger.error(`Failed to update backup scheduler: ${error}`);
				// dont fail the settings update for backup scheduler issues
			}

			// reload rate limiter if rate limiting settings were changed
			try {
				await reloadRateLimiter();
			} catch (error) {
				logger.error(`Failed to reload rate limiter: ${error}`);
				// dont fail the settings update for rate limiter issues
			}

			logger.info('Settings updated successfully');

			return { success: true, message: 'Settings updated successfully' };
		} catch (error) {
			logger.error(`Settings validation error: ${error}`);
			return fail(400, {
				error: 'Invalid settings data',
				data,
			});
		}
	},
} satisfies Actions;
