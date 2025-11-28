import { type Settings, settings } from '$database/schema';
import { eq } from 'drizzle-orm';
import { createChildLogger } from '$lib/server/logger';
import {
	type AllSettings,
	type AppSettingKey,
	SETTINGS_CONFIG,
	getSettingsEntries,
} from '$src/lib/shared/settings';
import { db } from './db';

const logger = createChildLogger('Settings');

/**
 * Enhanced Settings Service - Compatible with existing settings-helper.ts
 * Auto-initializes missing settings on first access
 */
class SettingsService {
	private cache = new Map<string, unknown>();
	private initialized = false;
	private initializationPromise: Promise<void> | null = null;

	private async waitForInitializationToFinish() {
		if (!this.initializationPromise) {
			return;
		}

		try {
			await this.initializationPromise;
		} catch (error) {
			logger.warn('Previous settings initialization failed', error);
		}
	}

	/**
	 * Initialize all missing settings with their default values
	 * This runs once on first settings access
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		this.initializationPromise = (async () => {
			logger.info('Initializing default settings...');

			try {
				// get all existing settings from database
				const existingSettings = await db.select().from(settings);
				const existingKeys = new Set(existingSettings.map((s) => s.key));

				// insert missing settings with defaults
				const missingSettings = getSettingsEntries()
					.filter(([key]) => !existingKeys.has(key))
					.map(([key, config]) => ({
						key,
						value: config.defaultValue,
						description: config.description,
						category: config.category,
					}));

				if (missingSettings.length > 0) {
					// use transaction with conflict handling to prevent race conditions
					await db.transaction(async (tx) => {
						for (const setting of missingSettings) {
							await tx.insert(settings).values(setting).onConflictDoNothing();
						}
					});
					logger.info(`Initialized ${missingSettings.length} default settings`);
				}

				// cache all settings for performance
				const allSettings = await db.select().from(settings);
				for (const setting of allSettings) {
					this.cache.set(setting.key!, setting.value);
				}

				this.initialized = true;
			} catch (error) {
				logger.error(`Failed to initialize settings: ${error}`);
				throw error;
			} finally {
				this.initializationPromise = null;
			}
		})();

		return this.initializationPromise;
	}

	/**
	 * Get setting by key - returns full database row or null (compatible with existing helper)
	 */
	async getSettingObjectByKey<K extends keyof AllSettings>(
		key: K
	): Promise<(Omit<Settings, 'value'> & { value: AllSettings[K] }) | null> {
		await this.initialize();

		const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
		if (result.length === 0) {
			return null;
		}

		// update cache
		this.cache.set(key, result[0].value);
		return {
			...result[0],
			value: result[0].value as AllSettings[K],
		};
	}

	/**
	 * Update setting by key (compatible with existing helper)
	 */
	async updateSettingByKey<K extends keyof AllSettings>(key: K, value: AllSettings[K]) {
		await this.initialize();

		// validate value if we have a schema for it
		const config = SETTINGS_CONFIG[key as keyof typeof SETTINGS_CONFIG];
		let validatedValue: AllSettings[K] = value;
		if (config) {
			validatedValue = config.schema.parse(value) as AllSettings[K];
		}

		const result = await db
			.update(settings)
			.set({ value: validatedValue })
			.where(eq(settings.key, key));

		// update cache
		this.cache.set(key, validatedValue);
		return result;
	}

	/**
	 * Bulk update settings with transaction support (compatible with existing helper)
	 */
	async updateSettings(settingsData: Partial<AllSettings>) {
		await this.initialize();

		return await db.transaction(async (tx) => {
			// remove all undefined values keys
			const filteredSettingsData = Object.fromEntries(
				Object.entries(settingsData).filter(([_, value]) => value !== undefined)
			) as Partial<AllSettings>;

			// process each setting update within the transaction
			for (const [key, value] of Object.entries(filteredSettingsData)) {
				// validate if we have a schema
				const config = SETTINGS_CONFIG[key as keyof typeof SETTINGS_CONFIG];
				const validatedValue = config ? config.schema.parse(value) : value;

				await tx
					.insert(settings)
					.values({
						key,
						value: validatedValue,
						description: config?.description,
						category: config?.category,
					})
					.onConflictDoUpdate({
						target: settings.key,
						set: { value: validatedValue },
					});

				// update cache
				this.cache.set(key, validatedValue);
			}

			return { success: true };
		});
	}

	/**
	 * Delete setting by key (compatible with existing helper)
	 */
	async deleteSettingByKey<K extends keyof AllSettings>(key: K) {
		const result = await db.delete(settings).where(eq(settings.key, key));

		// remove from cache
		this.cache.delete(key);
		return result;
	}

	/**
	 * delete all settings (compatible with existing helper)
	 */
	async deleteSettings() {
		await this.waitForInitializationToFinish();
		const result = await db.delete(settings);

		// clear cache
		this.cache.clear();
		this.initialized = false;
		this.initializationPromise = null;
		return result;
	}

	/**
	 * Get all settings from database (compatible with existing helper)
	 */
	async getAllSettings() {
		await this.initialize();
		return await db.select().from(settings);
	}

	/**
	 * Get a setting value by key with type safety and defaults
	 */
	async get<K extends AppSettingKey>(key: K): Promise<AllSettings[K]> {
		await this.initialize();

		if (this.cache.has(key)) {
			return this.cache.get(key) as AllSettings[K];
		}

		// fallback to database if not in cache
		const result = await db
			.select({ value: settings.value })
			.from(settings)
			.where(eq(settings.key, key))
			.limit(1);

		if (result.length === 0) {
			// return default value if setting doesn't exist
			const config = SETTINGS_CONFIG[key as keyof typeof SETTINGS_CONFIG];
			return config?.defaultValue as AllSettings[K];
		}

		const value = result[0].value as AllSettings[K];
		this.cache.set(key, value);
		return value;
	}

	/**
	 * Reset cache - useful for testing or when settings are changed externally
	 */
	async resetCache(): Promise<void> {
		await this.waitForInitializationToFinish();
		this.cache.clear();
		this.initialized = false;
		this.initializationPromise = null;
	}
}

// singleton instance
export const settingsService = new SettingsService();

export const getSettingObjectByKey = <K extends keyof AllSettings>(key: K) =>
	settingsService.getSettingObjectByKey(key);

export const updateSettingByKey = <K extends keyof AllSettings>(key: K, value: AllSettings[K]) =>
	settingsService.updateSettingByKey(key, value);

export const updateSettings = (settingsData: Partial<AllSettings>) =>
	settingsService.updateSettings(settingsData);

export const deleteSettingByKey = <K extends keyof AllSettings>(key: K) =>
	settingsService.deleteSettingByKey(key);

export const deleteSettings = () => settingsService.deleteSettings();

export const getAllSettings = () => settingsService.getAllSettings();

export const getSetting = <K extends AppSettingKey>(key: K) => settingsService.get(key);
