import { describe, expect, it } from 'vitest';
import {
	type AllSettings,
	type AppSettingKey,
	EXPIRY_ENUM_VALUES,
	EXPIRY_OPTIONS,
	EXPIRY_VALUES,
	type ExpiryEnumValue,
	type ExpiryValue,
	type InferSettingType,
	SETTINGS_CONFIG,
	SETTING_CATEGORIES,
	SETTING_CATEGORIES_VALUES,
	SETTING_DEFAULT_VALUES,
	SETTING_DESCRIPTIONS,
	SETTING_NAMES,
	type SettingCategory,
	allSettingsSchema,
	getSettingConfig,
	getSettingsByCategory,
	getSettingsEntries,
} from '../settings';

describe('settings.ts', () => {
	describe('SETTING_CATEGORIES', () => {
		it('should contain all category values', () => {
			expect(SETTING_CATEGORIES).toEqual({
				System: 'System',
				Search: 'Search',
				Backup: 'Backup',
				RateLimit: 'RateLimit',
				Expiry: 'Expiry',
			});
		});

		it('should be readonly', () => {
			expect(Object.keys(SETTING_CATEGORIES).length).toBe(5);
		});
	});

	describe('EXPIRY_OPTIONS', () => {
		it('should contain all expiry options with labels', () => {
			expect(EXPIRY_OPTIONS.length).toBe(8);

			EXPIRY_OPTIONS.forEach((option) => {
				expect(option).toHaveProperty('value');
				expect(option).toHaveProperty('label');
			});
		});

		it('should have correct structure for common options', () => {
			const neverOption = EXPIRY_OPTIONS.find((o) => o.value === 'never');
			expect(neverOption).toBeDefined();
			expect(neverOption?.label).toBe('never expire');

			const oneHourOption = EXPIRY_OPTIONS.find((o) => o.value === '1h');
			expect(oneHourOption).toBeDefined();
			expect(oneHourOption?.label).toBe('1 hour');
		});

		it('should include empty value for no change', () => {
			const noChangeOption = EXPIRY_OPTIONS.find((o) => o.value === '');
			expect(noChangeOption).toBeDefined();
			expect(noChangeOption?.label).toBe('no change (keep current)');
		});
	});

	describe('EXPIRY_VALUES', () => {
		it('should contain all expiry values from options', () => {
			expect(EXPIRY_VALUES.length).toBe(EXPIRY_OPTIONS.length);

			const expectedValues = EXPIRY_OPTIONS.map((o) => o.value);
			expect([...EXPIRY_VALUES]).toEqual(expectedValues);
		});
	});

	describe('EXPIRY_ENUM_VALUES', () => {
		it('should contain valid expiry enum values', () => {
			expect(EXPIRY_ENUM_VALUES).toEqual(['never', '10m', '1h', '1d', '1w', '1M', '1y']);
		});

		it('should not include empty string', () => {
			expect(EXPIRY_ENUM_VALUES).not.toContain('');
		});
	});

	describe('SETTINGS_CONFIG', () => {
		it('should be defined with all settings', () => {
			expect(SETTINGS_CONFIG).toBeDefined();
			expect(Object.keys(SETTINGS_CONFIG).length).toBeGreaterThan(0);
		});

		it('should have correct structure for each setting', () => {
			Object.entries(SETTINGS_CONFIG).forEach(([_, config]) => {
				expect(config).toHaveProperty('schema');
				expect(config).toHaveProperty('defaultValue');
				expect(config).toHaveProperty('description');
				expect(config).toHaveProperty('category');
				expect(typeof config.description).toBe('string');
			});
		});

		describe('System category settings', () => {
			it('should have firstTimeSetupCompleted setting', () => {
				expect(SETTINGS_CONFIG.firstTimeSetupCompleted).toBeDefined();
				expect(SETTINGS_CONFIG.firstTimeSetupCompleted.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.firstTimeSetupCompleted.category).toBe(SETTING_CATEGORIES.System);
			});

			it('should have publicRegistration setting', () => {
				expect(SETTINGS_CONFIG.publicRegistration).toBeDefined();
				expect(SETTINGS_CONFIG.publicRegistration.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.publicRegistration.category).toBe(SETTING_CATEGORIES.System);
			});

			it('should have maxPastesPerUser setting', () => {
				expect(SETTINGS_CONFIG.maxPastesPerUser).toBeDefined();
				expect(SETTINGS_CONFIG.maxPastesPerUser.defaultValue).toBe(1000);
				expect(SETTINGS_CONFIG.maxPastesPerUser.category).toBe(SETTING_CATEGORIES.System);
			});

			it('should have enableUnauthenticatedPasteCreation setting', () => {
				expect(SETTINGS_CONFIG.enableUnauthenticatedPasteCreation).toBeDefined();
				expect(SETTINGS_CONFIG.enableUnauthenticatedPasteCreation.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.enableUnauthenticatedPasteCreation.category).toBe(
					SETTING_CATEGORIES.System
				);
			});
		});

		describe('Search category settings', () => {
			it('should have enableFullTextSearch setting', () => {
				expect(SETTINGS_CONFIG.enableFullTextSearch).toBeDefined();
				expect(SETTINGS_CONFIG.enableFullTextSearch.defaultValue).toBe(true);
				expect(SETTINGS_CONFIG.enableFullTextSearch.category).toBe(SETTING_CATEGORIES.Search);
			});

			it('should have searchResultsLimit setting', () => {
				expect(SETTINGS_CONFIG.searchResultsLimit).toBeDefined();
				expect(SETTINGS_CONFIG.searchResultsLimit.defaultValue).toBe(50);
				expect(SETTINGS_CONFIG.searchResultsLimit.category).toBe(SETTING_CATEGORIES.Search);
			});
		});

		describe('Backup category settings', () => {
			it('should have filesystemBackupEnabled setting', () => {
				expect(SETTINGS_CONFIG.filesystemBackupEnabled).toBeDefined();
				expect(SETTINGS_CONFIG.filesystemBackupEnabled.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.filesystemBackupEnabled.category).toBe(SETTING_CATEGORIES.Backup);
			});

			it('should have s3BackupEnabled setting', () => {
				expect(SETTINGS_CONFIG.s3BackupEnabled).toBeDefined();
				expect(SETTINGS_CONFIG.s3BackupEnabled.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.s3BackupEnabled.category).toBe(SETTING_CATEGORIES.Backup);
			});

			it('should have r2BackupEnabled setting', () => {
				expect(SETTINGS_CONFIG.r2BackupEnabled).toBeDefined();
				expect(SETTINGS_CONFIG.r2BackupEnabled.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.r2BackupEnabled.category).toBe(SETTING_CATEGORIES.Backup);
			});

			it('should have backupCronPattern setting', () => {
				expect(SETTINGS_CONFIG.backupCronPattern).toBeDefined();
				expect(SETTINGS_CONFIG.backupCronPattern.defaultValue).toBe('0 3 * * *');
				expect(SETTINGS_CONFIG.backupCronPattern.category).toBe(SETTING_CATEGORIES.Backup);
			});

			it('should have backupRetentionDays setting', () => {
				expect(SETTINGS_CONFIG.backupRetentionDays).toBeDefined();
				expect(SETTINGS_CONFIG.backupRetentionDays.defaultValue).toBe(30);
				expect(SETTINGS_CONFIG.backupRetentionDays.category).toBe(SETTING_CATEGORIES.Backup);
			});

			it('should have enableAutoZip setting', () => {
				expect(SETTINGS_CONFIG.enableAutoZip).toBeDefined();
				expect(SETTINGS_CONFIG.enableAutoZip.defaultValue).toBe(true);
				expect(SETTINGS_CONFIG.enableAutoZip.category).toBe(SETTING_CATEGORIES.Backup);
			});
		});

		describe('RateLimit category settings', () => {
			it('should have rateLimitingAuthedEnabled setting', () => {
				expect(SETTINGS_CONFIG.rateLimitingAuthedEnabled).toBeDefined();
				expect(SETTINGS_CONFIG.rateLimitingAuthedEnabled.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.rateLimitingAuthedEnabled.category).toBe(
					SETTING_CATEGORIES.RateLimit
				);
			});

			it('should have rateLimitingAuthedLimit setting', () => {
				expect(SETTINGS_CONFIG.rateLimitingAuthedLimit).toBeDefined();
				expect(SETTINGS_CONFIG.rateLimitingAuthedLimit.defaultValue).toBe(20);
				expect(SETTINGS_CONFIG.rateLimitingAuthedLimit.category).toBe(SETTING_CATEGORIES.RateLimit);
			});

			it('should have rateLimitingUnauthenticatedEnabled setting', () => {
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedEnabled).toBeDefined();
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedEnabled.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedEnabled.category).toBe(
					SETTING_CATEGORIES.RateLimit
				);
			});

			it('should have rateLimitingUnauthenticatedLimit setting', () => {
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedLimit).toBeDefined();
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedLimit.defaultValue).toBe(3);
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedLimit.category).toBe(
					SETTING_CATEGORIES.RateLimit
				);
			});

			it('should have rateLimitingUnauthenticatedGlobalEnabled setting', () => {
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedGlobalEnabled).toBeDefined();
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedGlobalEnabled.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedGlobalEnabled.category).toBe(
					SETTING_CATEGORIES.RateLimit
				);
			});

			it('should have rateLimitingUnauthenticatedGlobalLimit setting', () => {
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedGlobalLimit).toBeDefined();
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedGlobalLimit.defaultValue).toBe(20);
				expect(SETTINGS_CONFIG.rateLimitingUnauthenticatedGlobalLimit.category).toBe(
					SETTING_CATEGORIES.RateLimit
				);
			});
		});

		describe('Expiry category settings', () => {
			it('should have forceExpiryAuthed setting', () => {
				expect(SETTINGS_CONFIG.forceExpiryAuthed).toBeDefined();
				expect(SETTINGS_CONFIG.forceExpiryAuthed.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.forceExpiryAuthed.category).toBe(SETTING_CATEGORIES.Expiry);
			});

			it('should have forceExpiryAuthedValue setting', () => {
				expect(SETTINGS_CONFIG.forceExpiryAuthedValue).toBeDefined();
				expect(SETTINGS_CONFIG.forceExpiryAuthedValue.defaultValue).toBe('1w');
				expect(SETTINGS_CONFIG.forceExpiryAuthedValue.category).toBe(SETTING_CATEGORIES.Expiry);
			});

			it('should have forceExpiryUnauthed setting', () => {
				expect(SETTINGS_CONFIG.forceExpiryUnauthed).toBeDefined();
				expect(SETTINGS_CONFIG.forceExpiryUnauthed.defaultValue).toBe(false);
				expect(SETTINGS_CONFIG.forceExpiryUnauthed.category).toBe(SETTING_CATEGORIES.Expiry);
			});

			it('should have forceExpiryUnauthedValue setting', () => {
				expect(SETTINGS_CONFIG.forceExpiryUnauthedValue).toBeDefined();
				expect(SETTINGS_CONFIG.forceExpiryUnauthedValue.defaultValue).toBe('1d');
				expect(SETTINGS_CONFIG.forceExpiryUnauthedValue.category).toBe(SETTING_CATEGORIES.Expiry);
			});
		});
	});

	describe('allSettingsSchema', () => {
		it('should validate valid settings object', () => {
			const validSettings = {
				firstTimeSetupCompleted: true,
				publicRegistration: true,
				maxPastesPerUser: 500,
				enableFullTextSearch: false,
				searchResultsLimit: 100,
				filesystemBackupEnabled: true,
				s3BackupEnabled: false,
				r2BackupEnabled: false,
				backupCronPattern: '0 2 * * *',
				backupRetentionDays: 60,
				enableAutoZip: true,
				rateLimitingAuthedEnabled: true,
				rateLimitingAuthedLimit: 50,
				enableUnauthenticatedPasteCreation: true,
				rateLimitingUnauthenticatedEnabled: true,
				rateLimitingUnauthenticatedLimit: 5,
				rateLimitingUnauthenticatedGlobalEnabled: true,
				rateLimitingUnauthenticatedGlobalLimit: 30,
				forceExpiryAuthed: false,
				forceExpiryAuthedValue: '1w' as ExpiryEnumValue,
				forceExpiryUnauthed: true,
				forceExpiryUnauthedValue: '1d' as ExpiryEnumValue,
			};

			expect(() => allSettingsSchema.parse(validSettings)).not.toThrow();
		});

		it('should validate default values', () => {
			const defaultSettings = {
				firstTimeSetupCompleted: false,
				publicRegistration: false,
				maxPastesPerUser: 1000,
				enableFullTextSearch: true,
				searchResultsLimit: 50,
				filesystemBackupEnabled: false,
				s3BackupEnabled: false,
				r2BackupEnabled: false,
				backupCronPattern: '0 3 * * *',
				backupRetentionDays: 30,
				enableAutoZip: true,
				rateLimitingAuthedEnabled: false,
				rateLimitingAuthedLimit: 20,
				enableUnauthenticatedPasteCreation: false,
				rateLimitingUnauthenticatedEnabled: false,
				rateLimitingUnauthenticatedLimit: 3,
				rateLimitingUnauthenticatedGlobalEnabled: false,
				rateLimitingUnauthenticatedGlobalLimit: 20,
				forceExpiryAuthed: false,
				forceExpiryAuthedValue: '1w' as ExpiryEnumValue,
				forceExpiryUnauthed: false,
				forceExpiryUnauthedValue: '1d' as ExpiryEnumValue,
			};

			expect(() => allSettingsSchema.parse(defaultSettings)).not.toThrow();
		});

		it('should reject invalid number values', () => {
			const invalidSettings = {
				...SETTING_DEFAULT_VALUES,
				maxPastesPerUser: -1, // negative not allowed
			};

			expect(() => allSettingsSchema.parse(invalidSettings)).toThrow();
		});

		it('should reject out of range values', () => {
			const invalidSettings = {
				...SETTING_DEFAULT_VALUES,
				searchResultsLimit: 300, // max is 200
			};

			expect(() => allSettingsSchema.parse(invalidSettings)).toThrow();
		});

		it('should reject invalid expiry enum values', () => {
			const invalidSettings = {
				...SETTING_DEFAULT_VALUES,
				forceExpiryAuthedValue: 'invalid',
			};

			expect(() => allSettingsSchema.parse(invalidSettings)).toThrow();
		});
	});

	describe('SETTING_NAMES', () => {
		it('should contain all setting keys', () => {
			expect(SETTING_NAMES.length).toBe(Object.keys(SETTINGS_CONFIG).length);
		});

		it('should match SETTINGS_CONFIG keys', () => {
			const configKeys = Object.keys(SETTINGS_CONFIG);
			expect([...SETTING_NAMES].sort()).toEqual(configKeys.sort());
		});
	});

	describe('SETTING_DESCRIPTIONS', () => {
		it('should have descriptions for all settings', () => {
			expect(Object.keys(SETTING_DESCRIPTIONS).length).toBe(Object.keys(SETTINGS_CONFIG).length);
		});

		it('should have non-empty descriptions', () => {
			Object.values(SETTING_DESCRIPTIONS).forEach((description) => {
				expect(description).toBeDefined();
				expect(description.length).toBeGreaterThan(0);
			});
		});

		it('should match descriptions from SETTINGS_CONFIG', () => {
			Object.entries(SETTINGS_CONFIG).forEach(([key, config]) => {
				expect(SETTING_DESCRIPTIONS[key as keyof typeof SETTINGS_CONFIG]).toBe(config.description);
			});
		});
	});

	describe('SETTING_CATEGORIES_VALUES', () => {
		it('should have categories for all settings', () => {
			expect(Object.keys(SETTING_CATEGORIES_VALUES).length).toBe(
				Object.keys(SETTINGS_CONFIG).length
			);
		});

		it('should have valid category values', () => {
			const validCategories = Object.values(SETTING_CATEGORIES);

			Object.values(SETTING_CATEGORIES_VALUES).forEach((category) => {
				expect(validCategories).toContain(category);
			});
		});

		it('should match categories from SETTINGS_CONFIG', () => {
			Object.entries(SETTINGS_CONFIG).forEach(([key, config]) => {
				expect(SETTING_CATEGORIES_VALUES[key as keyof typeof SETTINGS_CONFIG]).toBe(
					config.category
				);
			});
		});
	});

	describe('SETTING_DEFAULT_VALUES', () => {
		it('should have default values for all settings', () => {
			expect(Object.keys(SETTING_DEFAULT_VALUES).length).toBe(Object.keys(SETTINGS_CONFIG).length);
		});

		it('should match default values from SETTINGS_CONFIG', () => {
			Object.entries(SETTINGS_CONFIG).forEach(([key, config]) => {
				expect(SETTING_DEFAULT_VALUES[key as keyof typeof SETTINGS_CONFIG]).toEqual(
					config.defaultValue
				);
			});
		});

		it('should have valid types for default values', () => {
			expect(typeof SETTING_DEFAULT_VALUES.publicRegistration).toBe('boolean');
			expect(typeof SETTING_DEFAULT_VALUES.maxPastesPerUser).toBe('number');
			expect(typeof SETTING_DEFAULT_VALUES.backupCronPattern).toBe('string');
			expect(EXPIRY_ENUM_VALUES).toContain(SETTING_DEFAULT_VALUES.forceExpiryAuthedValue);
		});
	});

	describe('getSettingsEntries', () => {
		it('should return all settings entries', () => {
			const entries = getSettingsEntries();
			expect(entries.length).toBe(Object.keys(SETTINGS_CONFIG).length);
		});

		it('should return properly typed entries', () => {
			const entries = getSettingsEntries();

			entries.forEach(([key, config]) => {
				expect(SETTINGS_CONFIG[key]).toBeDefined();
				expect(config).toHaveProperty('schema');
				expect(config).toHaveProperty('defaultValue');
				expect(config).toHaveProperty('description');
				expect(config).toHaveProperty('category');
			});
		});

		it('should match Object.entries output', () => {
			const entries = getSettingsEntries();
			const objectEntries = Object.entries(SETTINGS_CONFIG);

			expect(entries.length).toBe(objectEntries.length);
		});
	});

	describe('getSettingConfig', () => {
		it('should return config for valid setting key', () => {
			const config = getSettingConfig('publicRegistration');
			expect(config).toBeDefined();
			expect(config.defaultValue).toBe(false);
			expect(config.category).toBe(SETTING_CATEGORIES.System);
		});

		it('should return correct config for all settings', () => {
			SETTING_NAMES.forEach((key) => {
				const config = getSettingConfig(key);
				expect(config).toBe(SETTINGS_CONFIG[key]);
			});
		});

		it('should return config with schema', () => {
			const config = getSettingConfig('maxPastesPerUser');
			expect(config.schema).toBeDefined();
			expect(() => config.schema.parse(1000)).not.toThrow();
		});
	});

	describe('getSettingsByCategory', () => {
		it('should return settings for System category', () => {
			const systemSettings = getSettingsByCategory(SETTING_CATEGORIES.System);
			expect(systemSettings.length).toBeGreaterThan(0);
			expect(systemSettings).toContain('publicRegistration');
			expect(systemSettings).toContain('maxPastesPerUser');
			expect(systemSettings).toContain('enableUnauthenticatedPasteCreation');
		});

		it('should return settings for Search category', () => {
			const searchSettings = getSettingsByCategory(SETTING_CATEGORIES.Search);
			expect(searchSettings.length).toBe(2);
			expect(searchSettings).toContain('enableFullTextSearch');
			expect(searchSettings).toContain('searchResultsLimit');
		});

		it('should return settings for Backup category', () => {
			const backupSettings = getSettingsByCategory(SETTING_CATEGORIES.Backup);
			expect(backupSettings.length).toBeGreaterThan(0);
			expect(backupSettings).toContain('filesystemBackupEnabled');
			expect(backupSettings).toContain('s3BackupEnabled');
			expect(backupSettings).toContain('r2BackupEnabled');
			expect(backupSettings).toContain('backupCronPattern');
			expect(backupSettings).toContain('backupRetentionDays');
			expect(backupSettings).toContain('enableAutoZip');
		});

		it('should return settings for RateLimit category', () => {
			const rateLimitSettings = getSettingsByCategory(SETTING_CATEGORIES.RateLimit);
			expect(rateLimitSettings.length).toBeGreaterThan(0);
			expect(rateLimitSettings).toContain('rateLimitingAuthedEnabled');
			expect(rateLimitSettings).toContain('rateLimitingAuthedLimit');
			expect(rateLimitSettings).toContain('rateLimitingUnauthenticatedEnabled');
			expect(rateLimitSettings).toContain('rateLimitingUnauthenticatedLimit');
		});

		it('should return settings for Expiry category', () => {
			const expirySettings = getSettingsByCategory(SETTING_CATEGORIES.Expiry);
			expect(expirySettings.length).toBe(4);
			expect(expirySettings).toContain('forceExpiryAuthed');
			expect(expirySettings).toContain('forceExpiryAuthedValue');
			expect(expirySettings).toContain('forceExpiryUnauthed');
			expect(expirySettings).toContain('forceExpiryUnauthedValue');
		});

		it('should return only settings matching the category', () => {
			const systemSettings = getSettingsByCategory(SETTING_CATEGORIES.System);

			systemSettings.forEach((key) => {
				const config = getSettingConfig(key);
				expect(config.category).toBe(SETTING_CATEGORIES.System);
			});
		});

		it('should return empty array for non-existent category', () => {
			const settings = getSettingsByCategory('NonExistent' as SettingCategory);
			expect(settings).toEqual([]);
		});
	});

	describe('type exports', () => {
		it('should export AllSettings type', () => {
			const settings: AllSettings = {
				firstTimeSetupCompleted: false,
				publicRegistration: false,
				maxPastesPerUser: 1000,
				enableFullTextSearch: true,
				searchResultsLimit: 50,
				filesystemBackupEnabled: false,
				s3BackupEnabled: false,
				r2BackupEnabled: false,
				backupCronPattern: '0 3 * * *',
				backupRetentionDays: 30,
				enableAutoZip: true,
				rateLimitingAuthedEnabled: false,
				rateLimitingAuthedLimit: 20,
				enableUnauthenticatedPasteCreation: false,
				rateLimitingUnauthenticatedEnabled: false,
				rateLimitingUnauthenticatedLimit: 3,
				rateLimitingUnauthenticatedGlobalEnabled: false,
				rateLimitingUnauthenticatedGlobalLimit: 20,
				forceExpiryAuthed: false,
				forceExpiryAuthedValue: '1w',
				forceExpiryUnauthed: false,
				forceExpiryUnauthedValue: '1d',
			};
			expect(settings.publicRegistration).toBe(false);
		});

		it('should export AppSettingKey type', () => {
			const key: AppSettingKey = 'publicRegistration';
			expect(key).toBe('publicRegistration');
		});

		it('should export SettingCategory type', () => {
			const category: SettingCategory = 'System';
			expect(category).toBe('System');
		});

		it('should export ExpiryValue type', () => {
			const value: ExpiryValue = '1h';
			expect(value).toBe('1h');
		});

		it('should export ExpiryEnumValue type', () => {
			const value: ExpiryEnumValue = '1w';
			expect(value).toBe('1w');
		});

		it('should export InferSettingType helper type', () => {
			type BoolType = InferSettingType<'publicRegistration'>;
			type NumType = InferSettingType<'maxPastesPerUser'>;
			type StringType = InferSettingType<'backupCronPattern'>;
			type EnumType = InferSettingType<'forceExpiryAuthedValue'>;

			const boolVal: BoolType = true;
			const numVal: NumType = 100;
			const strVal: StringType = '0 3 * * *';
			const enumVal: EnumType = '1w';

			expect(typeof boolVal).toBe('boolean');
			expect(typeof numVal).toBe('number');
			expect(typeof strVal).toBe('string');
			expect(enumVal).toBe('1w');
		});
	});

	describe('integration tests', () => {
		it('should maintain consistency between all derived objects', () => {
			const keys = Object.keys(SETTINGS_CONFIG);

			expect(SETTING_NAMES.length).toBe(keys.length);
			expect(Object.keys(SETTING_DESCRIPTIONS).length).toBe(keys.length);
			expect(Object.keys(SETTING_CATEGORIES_VALUES).length).toBe(keys.length);
			expect(Object.keys(SETTING_DEFAULT_VALUES).length).toBe(keys.length);
		});

		it('should have all settings in at least one category', () => {
			const allCategories = Object.values(SETTING_CATEGORIES);
			const allSettingsFromCategories = allCategories.flatMap((category) =>
				getSettingsByCategory(category)
			);

			SETTING_NAMES.forEach((key) => {
				expect(allSettingsFromCategories).toContain(key);
			});
		});

		it('should validate all default values with their schemas', () => {
			Object.entries(SETTINGS_CONFIG).forEach(([key, config]) => {
				const defaultValue = SETTING_DEFAULT_VALUES[key as keyof typeof SETTINGS_CONFIG];
				expect(() => config.schema.parse(defaultValue)).not.toThrow();
			});
		});
	});
});
