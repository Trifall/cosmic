import * as z from 'zod';

// --  settings

export const SETTING_CATEGORIES = {
	System: 'System',
	Search: 'Search',
	Backup: 'Backup',
	RateLimit: 'RateLimit',
	Expiry: 'Expiry',
} as const;

export type SettingCategory = (typeof SETTING_CATEGORIES)[keyof typeof SETTING_CATEGORIES];

// -- expiry options (shared source of truth)

export const EXPIRY_OPTIONS = [
	{ value: '', label: 'no change (keep current)' },
	{ value: 'never', label: 'never expire' },
	{ value: '10m', label: '10 minutes' },
	{ value: '1h', label: '1 hour' },
	{ value: '1d', label: '1 day' },
	{ value: '1w', label: '1 week' },
	{ value: '1M', label: '1 month' },
	{ value: '1y', label: '1 year' },
] as const;

export const EXPIRY_VALUES = EXPIRY_OPTIONS.map((option) => option.value) as readonly string[];
export const EXPIRY_ENUM_VALUES = ['never', '10m', '1h', '1d', '1w', '1M', '1y'] as const;

export type ExpiryValue = (typeof EXPIRY_VALUES)[number];
export type ExpiryEnumValue = (typeof EXPIRY_ENUM_VALUES)[number];

export const SETTINGS_CONFIG = {
	firstTimeSetupCompleted: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Flag to indicate if the initial application setup has been completed.',
		category: SETTING_CATEGORIES.System,
	},
	publicRegistration: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Allow new users to register.',
		category: SETTING_CATEGORIES.System,
	},
	maxPastesPerUser: {
		schema: z.number().int().min(1).max(100000),
		defaultValue: 1000,
		description: 'Maximum number of pastes a user can create',
		category: SETTING_CATEGORIES.System,
	},
	enableFullTextSearch: {
		schema: z.boolean(),
		defaultValue: true,
		description: 'Enable full-text search across paste content',
		category: SETTING_CATEGORIES.Search,
	},
	searchResultsLimit: {
		schema: z.number().int().min(1).max(200),
		defaultValue: 50,
		description: 'Maximum number of search results to return',
		category: SETTING_CATEGORIES.Search,
	},
	filesystemBackupEnabled: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Enable automatic file system database backups',
		category: SETTING_CATEGORIES.Backup,
	},
	s3BackupEnabled: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Enable automatic S3 database backup uploads',
		category: SETTING_CATEGORIES.Backup,
	},
	r2BackupEnabled: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Enable automatic Cloudflare R2 database backup uploads',
		category: SETTING_CATEGORIES.Backup,
	},
	backupCronPattern: {
		schema: z.string(),
		defaultValue: '0 3 * * *',
		description: 'Cron expression for automatic backups (default: 3 AM daily)',
		category: SETTING_CATEGORIES.Backup,
	},
	backupRetentionDays: {
		schema: z.number().int().min(1).max(365),
		defaultValue: 30,
		description: 'Number of days to keep local file system backup files',
		category: SETTING_CATEGORIES.Backup,
	},
	enableAutoZip: {
		schema: z.boolean(),
		defaultValue: true,
		description: 'Automatically compress backups into ZIP files',
		category: SETTING_CATEGORIES.Backup,
	},

	rateLimitingAuthedEnabled: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Enable rate limiting for authenticated users on paste create/edit operations',
		category: SETTING_CATEGORIES.RateLimit,
	},
	rateLimitingAuthedLimit: {
		schema: z.number().int().min(1).max(100000),
		defaultValue: 20,
		description:
			'Maximum number of paste create/edit operations allowed per authenticated user in a 1-minute sliding window',
		category: SETTING_CATEGORIES.RateLimit,
	},
	enableUnauthenticatedPasteCreation: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Allow unauthenticated users to create pastes',
		category: SETTING_CATEGORIES.System,
	},
	rateLimitingUnauthenticatedEnabled: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Enable rate limiting per unauthenticated user (by browser fingerprint)',
		category: SETTING_CATEGORIES.RateLimit,
	},
	rateLimitingUnauthenticatedLimit: {
		schema: z.number().int().min(1).max(100000),
		defaultValue: 3,
		description:
			'Maximum number of paste create operations allowed per unauthenticated user in a 1-minute sliding window',
		category: SETTING_CATEGORIES.RateLimit,
	},
	rateLimitingUnauthenticatedGlobalEnabled: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Enable global rate limiting for all unauthenticated users combined',
		category: SETTING_CATEGORIES.RateLimit,
	},
	rateLimitingUnauthenticatedGlobalLimit: {
		schema: z.number().int().min(1).max(100000),
		defaultValue: 20,
		description:
			'Maximum number of paste create operations allowed system-wide for all unauthenticated users in a 1-minute sliding window',
		category: SETTING_CATEGORIES.RateLimit,
	},

	forceExpiryAuthed: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Force expiry time for all authenticated users',
		category: SETTING_CATEGORIES.Expiry,
	},
	forceExpiryAuthedValue: {
		schema: z.enum(EXPIRY_ENUM_VALUES),
		defaultValue: '1w',
		description: 'Default expiry time for authenticated users when forced',
		category: SETTING_CATEGORIES.Expiry,
	},
	forceExpiryUnauthed: {
		schema: z.boolean(),
		defaultValue: false,
		description: 'Force expiry time for all unauthenticated users',
		category: SETTING_CATEGORIES.Expiry,
	},
	forceExpiryUnauthedValue: {
		schema: z.enum(EXPIRY_ENUM_VALUES),
		defaultValue: '1d',
		description: 'Default expiry time for unauthenticated users when forced',
		category: SETTING_CATEGORIES.Expiry,
	},
} as const;

export const allSettingsSchema = z.object(
	Object.fromEntries(
		Object.entries(SETTINGS_CONFIG).map(([key, config]) => [key, config.schema])
	) as {
		[K in keyof typeof SETTINGS_CONFIG]: (typeof SETTINGS_CONFIG)[K]['schema'];
	}
);

// derive all the objects from single source of truth
export const SETTING_NAMES = Object.keys(SETTINGS_CONFIG) as (keyof typeof SETTINGS_CONFIG)[];

export const SETTING_DESCRIPTIONS = Object.fromEntries(
	Object.entries(SETTINGS_CONFIG).map(([key, config]) => [key, config.description])
) as {
	[_ in keyof typeof SETTINGS_CONFIG]: string;
};

export const SETTING_CATEGORIES_VALUES = Object.fromEntries(
	Object.entries(SETTINGS_CONFIG).map(([key, config]) => [key, config.category])
) as {
	[_ in keyof typeof SETTINGS_CONFIG]: SettingCategory;
};

export const SETTING_DEFAULT_VALUES = Object.fromEntries(
	Object.entries(SETTINGS_CONFIG).map(([key, config]) => [key, config.defaultValue])
) as {
	[_ in keyof typeof SETTINGS_CONFIG]: InferSettingType<_>;
};

// types
export type AllSettings = z.infer<typeof allSettingsSchema>;
export type AppSettingKey = keyof AllSettings;

/**
 * helper type to get the inferred type from a schema, see examples:
 * @example type BooleanType = InferSettingType<'enableAutoConvert'>; // boolean
 * @example type StringType = InferSettingType<'targetFormat'>; // 'epub' | 'mobi' | etc.
 */
export type InferSettingType<T extends keyof typeof SETTINGS_CONFIG> = z.infer<
	(typeof SETTINGS_CONFIG)[T]['schema']
>;

// getters

/**
 * correctly types the entries of SETTINGS_CONFIG
 * @returns Array of [key, value] pairs from SETTINGS_CONFIG
 */
export const getSettingsEntries = () => {
	return Object.entries(SETTINGS_CONFIG) as Array<
		[keyof typeof SETTINGS_CONFIG, (typeof SETTINGS_CONFIG)[keyof typeof SETTINGS_CONFIG]]
	>;
};

/**
 * @param key
 * @returns The configuration object for a specific setting key
 */
export const getSettingConfig = <K extends AppSettingKey>(key: K) =>
	SETTINGS_CONFIG[key as keyof typeof SETTINGS_CONFIG];

/**
 * @param category
 * @returns Array of keys from SETTINGS_CONFIG that match the given category
 */
export const getSettingsByCategory = (category: SettingCategory) =>
	getSettingsEntries()
		.filter(([, config]) => config.category === category)
		.map(([key]) => key as AppSettingKey);
