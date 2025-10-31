import { relations } from 'drizzle-orm';
import { account, session, user } from './auth.schema';
import { logs } from './system';

/**
 * Relation Definitions for Users (extending from auth.schema)
 */
export const userRelations = relations(user, ({ many }) => ({
	// one-to-many relation: A user can have multiple sessions
	sessions: many(session),
	// one-to-many relation: A user can have multiple linked accounts (OAuth, etc.)
	accounts: many(account),
	// one-to-many relation: A user can be associated with multiple log entries
	logs: many(logs),
}));
