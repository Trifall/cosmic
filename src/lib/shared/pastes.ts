import { ROUTES } from '@/src/lib/routes';
import { SupportedLanguageSchema } from '@/src/lib/shared/languages';
import * as z from 'zod';

// extract unique base route segments from route paths
const extractRouteSegments = (routes: typeof ROUTES): string[] => {
	const segments = new Set<string>([
		// add common routes that might not be in main routes
		'raw',
		'edit',
		'delete',
		'new',
		'create',
		'api',
		'auth',
		// common web app routes
		'about',
		'contact',
		'contact-us',
		'help',
		'support',
		'faq',
		'terms',
		'terms-of-service',
		'privacy',
		'privacy-policy',
		'legal',
		'legal-notice',
		'docs',
		'documentation',
		'search',
		'blog',
		'news',
		'status',
		'health',
		// file/media related routes
		'static',
		'assets',
		'public',
		'uploads',
		'files',
		'media',
		'images',
		'download',
		// auth/user related
		'login',
		'logout',
		'register',
		'account',
		'user',
		'robots',
		'sitemap',
		'favicon',
		'feed',
		'rss',
		'webhook',
		'oauth',
		'well-known',
	]);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const processValue = (value: any) => {
		if (typeof value === 'string') {
			// extract the first segment after leading slash, ignore params
			const match = value.match(/^\/([^\/\{]+)/);
			if (match && match[1]) {
				segments.add(match[1]);
			}
		} else if (typeof value === 'object' && value !== null) {
			Object.values(value).forEach(processValue);
		}
	};

	Object.values(routes).forEach(processValue);

	return Array.from(segments);
};

// derive reserved routes from the ROUTES object
const RESERVED_ROUTES = extractRouteSegments(ROUTES);

// shared visibility enum values - must match database enum
export const VISIBILITY_VALUES = ['PUBLIC', 'AUTHENTICATED', 'INVITE_ONLY', 'PRIVATE'] as const;

export type Visibility = (typeof VISIBILITY_VALUES)[number];

export const VisibilitySchema = z.enum(VISIBILITY_VALUES);

export const visibilityOptions: { value: Visibility; label: string; description: string }[] = [
	{ value: 'PUBLIC', label: 'Public', description: 'Anyone with the link can view' },
	{
		value: 'AUTHENTICATED',
		label: 'Authenticated Only',
		description: 'Only logged-in users can view',
	},
	{ value: 'INVITE_ONLY', label: 'Invite Only', description: 'Only invited users can view' },
	{ value: 'PRIVATE', label: 'Private', description: 'Only you can view' },
];

// Invited User (PasteInvite)
export type InvitedUser = {
	id: string;
	username: string;
	displayUsername: string | null;
	invitedAt: Date;
};

// custom slug validation - alphanumeric, hyphens, underscores only, and no reserved routes
export const PasteSlugSchema = z
	.string()
	.min(1, 'URL must not be empty')
	.max(100, 'URL must be 100 characters or less')
	.regex(/^[a-zA-Z0-9_-]+$/, 'URL can only contain letters, numbers, hyphens, and underscores')
	.refine(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(slug: string) => !RESERVED_ROUTES.includes(slug.toLowerCase() as any),
		'This URL is reserved and cannot be used'
	);

// content validation with 400KB limit (400,000 bytes)
const ContentSchema = z.string().superRefine((content, ctx) => {
	// check if empty first
	if (content.length === 0) {
		ctx.addIssue({
			code: 'too_small',
			minimum: 1,
			origin: 'string',
			type: 'string',
			inclusive: true,
			message: 'Content cannot be empty',
		});
		return;
	}

	// check byte size (most important limit)
	const byteSize = new Blob([content]).size;
	if (byteSize > 400000) {
		ctx.addIssue({
			code: 'custom',
			message: `Content cannot exceed 400KB (~400,000 Characters). ~${(byteSize / 1000).toFixed(0)}KB/400KB`,
		});
		return;
	}

	// check character count as fallback
	if (content.length > 400000) {
		ctx.addIssue({
			code: 'too_big',
			maximum: 400000,
			origin: 'string',
			type: 'string',
			inclusive: true,
			message: 'Content must be less than 400,000 characters',
		});
		return;
	}
});

// paste creation schema
export const CreatePasteBaseSchema = z.object({
	content: ContentSchema,
	visibility: VisibilitySchema.default('PUBLIC'),
	customSlug: PasteSlugSchema.optional(),
	language: SupportedLanguageSchema.default('plaintext'),
	title: z.string().max(255, 'Title must be 255 characters or less').optional(),
	password: z.string().max(100, 'Password must be 100 characters or less').optional(),
	expiresAt: z.date().nullable().optional(),
	invitedUsers: z.array(z.string()).optional(), // Array of user IDs for INVITE_ONLY pastes
	burnAfterReading: z.boolean().default(false), // delete paste after first read
	// versioning controls
	versioningEnabled: z.boolean().default(false).optional(),
	versionHistoryVisible: z.boolean().default(false).optional(),
});

type CreatePasteBase = z.infer<typeof CreatePasteBaseSchema>;

export const CreatePasteSchema = CreatePasteBaseSchema.refine(
	(data: CreatePasteBase) =>
		data.visibility !== 'INVITE_ONLY' || (data.invitedUsers && data.invitedUsers.length > 0),
	{ message: 'Invited users are required for INVITE_ONLY visibility', path: ['invitedUsers'] }
)
	.refine(
		(data: CreatePasteBase) =>
			data.visibility === 'INVITE_ONLY' || !data.invitedUsers || data.invitedUsers.length === 0,
		{
			message: 'Invited users should only be specified for INVITE_ONLY visibility',
			path: ['invitedUsers'],
		}
	)
	.refine(
		// if versioning is disabled, versionHistoryVisible must be false/undefined
		(data: CreatePasteBase & { versioningEnabled?: boolean; versionHistoryVisible?: boolean }) =>
			!data.versionHistoryVisible || data.versioningEnabled === true,
		{
			message: 'Version history visibility can only be enabled when versioning is enabled',
			path: ['versionHistoryVisible'],
		}
	)
	.refine(
		(data: CreatePasteBase) => {
			if (data.expiresAt === undefined || data.expiresAt === null) {
				return true;
			}
			// check that the date is in the future
			return data.expiresAt > new Date();
		},
		{
			message: 'Expiry date must be in the future',
			path: ['expiresAt'],
		}
	);

export type CreatePasteData = z.infer<typeof CreatePasteSchema>;

// update paste schema - all fields are optional for partial updates
export const UpdatePasteSchema = z
	.object({
		content: ContentSchema.optional(),
		visibility: VisibilitySchema.optional(),
		customSlug: PasteSlugSchema.optional(),
		language: SupportedLanguageSchema.optional(),
		title: z.string().max(255, 'Title must be 255 characters or less').optional(),
		password: z.string().max(100, 'Password must be 100 characters or less').optional().nullable(),
		expiresAt: z.date().nullable().optional(),
		invitedUsers: z.array(z.string()).optional(), // Array of user IDs for INVITE_ONLY pastes
		removedUsers: z.array(z.string()).optional(), // Array of user IDs to remove from invites
		burnAfterReading: z.boolean().optional(),
		// versioning controls
		versioningEnabled: z.boolean().optional(),
		versionHistoryVisible: z.boolean().optional(),
	})
	.refine((data) => !data.versionHistoryVisible || data.versioningEnabled === true, {
		message: 'Version history visibility can only be enabled when versioning is enabled',
		path: ['versionHistoryVisible'],
	})
	.refine(
		(data) => {
			if (data.expiresAt === undefined || data.expiresAt === null) {
				return true;
			}
			// check that the date is in the future
			return data.expiresAt > new Date();
		},
		{
			message: 'Expiry date must be in the future',
			path: ['expiresAt'],
		}
	);

export type UpdatePasteData = z.infer<typeof UpdatePasteSchema>;

// schema for paste viewing/loading
export const PasteViewSchema = z.object({
	slug: z.string().min(1, 'Invalid paste identifier'),
});

export type PasteViewData = z.infer<typeof PasteViewSchema>;

// schema for single paste data (used in profile and listing views)
export const SinglePasteDataSchema = z.object({
	id: z.string(),
	customSlug: z.string().nullable(),
	title: z.string().nullable(),
	content: z.string().optional().nullable(),
	language: SupportedLanguageSchema.nullable(),
	visibility: VisibilitySchema,
	views: z.number().int().min(0),
	createdAt: z.date(),
	updatedAt: z.date(),
	expiresAt: z.date().nullable(),
	owner_id: z.string(),
	ownerUsername: z.string().nullable(),
	hasPassword: z.boolean(),
});

export type SinglePasteData = z.infer<typeof SinglePasteDataSchema>;
