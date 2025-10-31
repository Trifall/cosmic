import { bigserial, index, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

/**
 * Settings Table
 * Stores system-wide configuration settings as key-value pairs.
 */
export const settings = pgTable('settings', {
	key: varchar('key').primaryKey(), // unique key identifying the setting
	value: jsonb('value'), // the value of the setting, stored as JSON to accommodate various data types
	description: text('description'), // optional description of the setting's purpose
	category: varchar('category'), // category of the setting (e.g., 'System', 'Automated Services', 'Backup', 'Conversion')
});

export type Settings = typeof settings.$inferSelect;

/**
 * Logs Table
 * Records system events, errors, and other relevant information for debugging and monitoring.
 */
export const logs = pgTable(
	'logs',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(), // unique identifier for the log entry
		timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(), // timestamp when the log event occurred
		level: varchar('level').notNull(), // severity level of the log (e.g., 'INFO', 'WARN', 'ERROR')
		source: varchar('source').notNull(), // origin of the log entry (e.g., 'API', 'BackgroundWorker', 'Auth')
		userId: text('user_id').references(() => user.id), // optional reference to the user associated with the event
		message: text('message').notNull(), // the main log message
		details: jsonb('details'), // additional structured details about the event, stored as JSON
		traceId: varchar('trace_id'), // optional identifier to correlate logs related to a single request or operation
	},
	(table) => [
		index('logs_trace_id_idx').on(table.traceId), // index for faster querying by trace ID
		index('logs_user_id_idx').on(table.userId), // index for faster querying by user ID
		index('logs_timestamp_idx').on(table.timestamp), // index for faster querying and sorting by timestamp
	]
);
