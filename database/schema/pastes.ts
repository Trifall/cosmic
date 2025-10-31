// database/schema/pastes.ts
import { relations } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
	varchar,
} from 'drizzle-orm/pg-core';
import { VISIBILITY_VALUES } from '$src/lib/shared/pastes';
import { user } from './auth.schema';

// --- ENUMS ---
// Use the shared visibility values to ensure consistency
export const visibilityEnum = pgEnum('visibility', VISIBILITY_VALUES);

// --- PASTE TABLES ---
export const pastes = pgTable(
	'pastes',
	{
		id: varchar('id', { length: 8 }).primaryKey(), // Auto-generated short ID
		customSlug: varchar('custom_slug', { length: 100 }), // Optional custom URL slug
		content: text('content').notNull(),
		owner_id: text('owner_id').references(() => user.id, { onDelete: 'cascade' }),
		visibility: visibilityEnum('visibility').default('PUBLIC').notNull(),
		language: text('language').default('plaintext'),
		title: text('title'), // Optional paste title
		views: integer('views').default(0).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		expiresAt: timestamp('expires_at'), // Optional expiration
		uniqueViews: integer('unique_views').default(0).notNull(), // Track unique visitors
		lastViewedAt: timestamp('last_viewed_at'), // Track when last viewed
		searchVector: text('search_vector').$type<unknown>(), // PostgreSQL tsvector for full-text search
		currentVersion: integer('current_version').default(1).notNull(), // Current version number
		burnAfterReading: boolean('burn_after_reading').default(false).notNull(), // Delete paste after first read
		passwordHash: text('password_hash'), // Optional password protection (bcrypt hashed)
		// versioning controls
		versioningEnabled: boolean('versioning_enabled').default(false).notNull(),
		versionHistoryVisible: boolean('version_history_visible').default(false).notNull(),
	},
	(table) => [
		index('pastes_owner_id_idx').on(table.owner_id),
		index('pastes_visibility_idx').on(table.visibility),
		index('pastes_created_at_idx').on(table.createdAt),
		// GIN index for search_vector will be created manually via SQL
		unique('pastes_custom_slug_unique').on(table.customSlug),
	]
);

// For INVITE_ONLY pastes: tracks which users can access specific pastes
export const pasteInvites = pgTable(
	'paste_invites',
	{
		id: serial('id').primaryKey(),
		pasteId: varchar('paste_id', { length: 8 })
			.notNull()
			.references(() => pastes.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		invitedAt: timestamp('invited_at').defaultNow().notNull(),
		invitedBy: text('invited_by')
			.notNull()
			.references(() => user.id),
	},
	(table) => [
		index('paste_invites_paste_id_idx').on(table.pasteId),
		index('paste_invites_user_id_idx').on(table.userId),
		unique('paste_invites_paste_user_unique').on(table.pasteId, table.userId),
	]
);

// Paste Version History: tracks all versions of a paste
export const pasteVersions = pgTable(
	'paste_versions',
	{
		id: serial('id').primaryKey(),
		pasteId: varchar('paste_id', { length: 8 })
			.notNull()
			.references(() => pastes.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		versionNumber: integer('version_number').notNull(),
		changeDescription: text('change_description'), // Optional description of changes
		createdAt: timestamp('created_at').defaultNow().notNull(),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
	},
	(table) => [
		index('paste_versions_paste_id_idx').on(table.pasteId),
		index('paste_versions_created_at_idx').on(table.createdAt),
		unique('paste_versions_paste_version_unique').on(table.pasteId, table.versionNumber),
	]
);

// Detailed Analytics: tracks individual paste views
export const pasteViews = pgTable(
	'paste_views',
	{
		id: serial('id').primaryKey(),
		pasteId: varchar('paste_id', { length: 8 })
			.notNull()
			.references(() => pastes.id, { onDelete: 'cascade' }),
		viewerIp: varchar('viewer_ip', { length: 45 }), // IPv6 support
		viewedAt: timestamp('viewed_at').defaultNow().notNull(),
		userAgent: text('user_agent'),
		userId: text('user_id').references(() => user.id), // Optional if user is logged in
		referrer: text('referrer'), // Where they came from
	},
	(table) => [
		index('paste_views_paste_id_idx').on(table.pasteId),
		index('paste_views_viewed_at_idx').on(table.viewedAt),
		index('paste_views_user_id_idx').on(table.userId),
	]
);

// --- RELATIONS ---
export const pastesRelations = relations(pastes, ({ one, many }) => ({
	owner: one(user, {
		fields: [pastes.owner_id],
		references: [user.id],
	}),
	invites: many(pasteInvites),
	versions: many(pasteVersions),
	views: many(pasteViews),
}));

export const pasteInvitesRelations = relations(pasteInvites, ({ one }) => ({
	paste: one(pastes, {
		fields: [pasteInvites.pasteId],
		references: [pastes.id],
	}),
	user: one(user, {
		fields: [pasteInvites.userId],
		references: [user.id],
	}),
	inviter: one(user, {
		fields: [pasteInvites.invitedBy],
		references: [user.id],
	}),
}));

export const pasteVersionsRelations = relations(pasteVersions, ({ one }) => ({
	paste: one(pastes, {
		fields: [pasteVersions.pasteId],
		references: [pastes.id],
	}),
	creator: one(user, {
		fields: [pasteVersions.createdBy],
		references: [user.id],
	}),
}));

export const pasteViewsRelations = relations(pasteViews, ({ one }) => ({
	paste: one(pastes, {
		fields: [pasteViews.pasteId],
		references: [pastes.id],
	}),
	viewer: one(user, {
		fields: [pasteViews.userId],
		references: [user.id],
	}),
}));
