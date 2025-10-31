import type { user } from './auth.schema';

export * from './auth.schema';
export * from './base';
export * from './pastes';
export * from './system';
export * from './pastes';

export type DBUser = typeof user.$inferSelect;
