/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DBUser } from '@/database/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import {
	clearStatsCache,
	getLastBackupTime,
	getPasteStatistics,
	getSessionStats,
	getUserStats,
} from '../stats';

// mock the database
vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(),
		transaction: vi.fn(),
	},
}));

// mock the logger
vi.mock('$lib/server/logger', () => ({
	createChildLogger: vi.fn(() => ({
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	})),
}));

// mock the auth module
vi.mock('@/src/lib/server/auth', () => ({
	requirePermission: vi.fn(),
}));

describe('Stats Module', () => {
	const mockAdminUser: DBUser = {
		id: 'admin-123',
		username: 'admin',
		email: 'admin@example.com',
		emailVerified: true,
		displayUsername: 'Admin User',
		createdAt: new Date(),
		updatedAt: new Date(),
		banned: false,
		banReason: null,
		banExpires: null,
		image: null,
		name: 'admin',
		role: 'admin',
	};

	beforeEach(() => {
		vi.clearAllMocks();
		clearStatsCache();
	});

	describe('clearStatsCache', () => {
		it('should clear all cached statistics', () => {
			// this is a simple test to ensure the function exists and runs
			expect(() => clearStatsCache()).not.toThrow();
		});
	});

	describe('getPasteStatistics', () => {
		it('should return comprehensive paste statistics', async () => {
			const mockBasicStats = [
				{
					totalPastes: 100,
					totalViews: 5000,
					totalUniqueViews: 3000,
					authedPastes: 80,
					unauthedPastes: 20,
					publicPastes: 50,
					authenticatedPastes: 20,
					inviteOnlyPastes: 10,
					privatePastes: 20,
					passwordProtectedCount: 15,
				},
			];

			const mockMostViewed = [
				{
					id: 'paste-123',
					title: 'Popular Paste',
					views: 1000,
					visibility: 'PUBLIC',
					createdAt: new Date('2024-01-01'),
					customSlug: 'popular',
					ownerUsername: 'testuser',
				},
			];

			const mockLanguages = [
				{ language: 'javascript', count: 30 },
				{ language: 'python', count: 25 },
				{ language: 'typescript', count: 20 },
			];

			const mockActiveUsers = [
				{
					userId: 'user-1',
					username: 'user1',
					displayUsername: 'User One',
					pasteCount: 50,
				},
				{
					userId: 'user-2',
					username: 'user2',
					displayUsername: 'User Two',
					pasteCount: 30,
				},
			];

			const mockRecentActivity = [
				{
					last24h: 10,
					last7d: 50,
					last30d: 200,
				},
			];

			// setup chained mock responses
			const mockSelect = vi.fn();
			const mockFrom = vi.fn();
			const mockLeftJoin = vi.fn();
			const mockInnerJoin = vi.fn();
			const mockWhere = vi.fn();
			const mockGroupBy = vi.fn();
			const mockOrderBy = vi.fn();
			const mockLimit = vi.fn();

			// first call: basic stats
			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce(Promise.resolve(mockBasicStats));

			// second call: most viewed paste
			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce({ leftJoin: mockLeftJoin });
			mockLeftJoin.mockReturnValueOnce({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
			mockLimit.mockReturnValueOnce(Promise.resolve(mockMostViewed));

			// third call: language distribution
			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce({ groupBy: mockGroupBy });
			mockGroupBy.mockReturnValueOnce({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
			mockLimit.mockReturnValueOnce(Promise.resolve(mockLanguages));

			// fourth call: most active users
			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce({ innerJoin: mockInnerJoin });
			mockInnerJoin.mockReturnValueOnce({ where: mockWhere });
			mockWhere.mockReturnValueOnce({ groupBy: mockGroupBy });
			mockGroupBy.mockReturnValueOnce({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
			mockLimit.mockReturnValueOnce(Promise.resolve(mockActiveUsers));

			// fifth call: recent activity
			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce(Promise.resolve(mockRecentActivity));

			(db.select as any) = mockSelect;

			const result = await getPasteStatistics(mockAdminUser);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalPastes).toBe(100);
				expect(result.value.totalViews).toBe(5000);
				expect(result.value.totalUniqueViews).toBe(3000);
				expect(result.value.averageViewsPerPaste).toBe(50);
				expect(result.value.authedPastes).toBe(80);
				expect(result.value.unauthedPastes).toBe(20);
				expect(result.value.passwordProtectedCount).toBe(15);
				expect(result.value.visibilityBreakdown).toEqual({
					PUBLIC: 50,
					AUTHENTICATED: 20,
					INVITE_ONLY: 10,
					PRIVATE: 20,
				});
				expect(result.value.languageDistribution).toHaveLength(3);
				expect(result.value.mostActiveUsers).toHaveLength(2);
				expect(result.value.recentActivity.last24h).toBe(10);
			}
		});

		it('should handle no pastes gracefully', async () => {
			const mockBasicStats = [
				{
					totalPastes: 0,
					totalViews: 0,
					totalUniqueViews: 0,
					authedPastes: 0,
					unauthedPastes: 0,
					publicPastes: 0,
					authenticatedPastes: 0,
					inviteOnlyPastes: 0,
					privatePastes: 0,
					passwordProtectedCount: 0,
				},
			];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();
			const mockLeftJoin = vi.fn();
			const mockInnerJoin = vi.fn();
			const mockWhere = vi.fn();
			const mockGroupBy = vi.fn();
			const mockOrderBy = vi.fn();
			const mockLimit = vi.fn();

			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce(Promise.resolve(mockBasicStats));

			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce({ leftJoin: mockLeftJoin });
			mockLeftJoin.mockReturnValueOnce({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
			mockLimit.mockReturnValueOnce(Promise.resolve([]));

			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce({ groupBy: mockGroupBy });
			mockGroupBy.mockReturnValueOnce({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
			mockLimit.mockReturnValueOnce(Promise.resolve([]));

			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce({ innerJoin: mockInnerJoin });
			mockInnerJoin.mockReturnValueOnce({ where: mockWhere });
			mockWhere.mockReturnValueOnce({ groupBy: mockGroupBy });
			mockGroupBy.mockReturnValueOnce({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
			mockLimit.mockReturnValueOnce(Promise.resolve([]));

			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce(Promise.resolve([{ last24h: 0, last7d: 0, last30d: 0 }]));

			(db.select as any) = mockSelect;

			const result = await getPasteStatistics(mockAdminUser);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalPastes).toBe(0);
				expect(result.value.averageViewsPerPaste).toBe(0);
				expect(result.value.mostViewedPaste).toBeNull();
				expect(result.value.languageDistribution).toEqual([]);
				expect(result.value.mostActiveUsers).toEqual([]);
			}
		});

		it('should use cached data on subsequent calls within TTL', async () => {
			const mockBasicStats = [
				{
					totalPastes: 100,
					totalViews: 5000,
					totalUniqueViews: 3000,
					authedPastes: 80,
					unauthedPastes: 20,
					publicPastes: 50,
					authenticatedPastes: 20,
					inviteOnlyPastes: 10,
					privatePastes: 20,
					passwordProtectedCount: 15,
				},
			];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();
			const mockLeftJoin = vi.fn();
			const mockInnerJoin = vi.fn();
			const mockWhere = vi.fn();
			const mockGroupBy = vi.fn();
			const mockOrderBy = vi.fn();
			const mockLimit = vi.fn();

			// first call setup
			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue(Promise.resolve(mockBasicStats));

			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce(Promise.resolve(mockBasicStats));

			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce({ leftJoin: mockLeftJoin });
			mockLeftJoin.mockReturnValueOnce({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
			mockLimit.mockReturnValueOnce(Promise.resolve([]));

			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce({ groupBy: mockGroupBy });
			mockGroupBy.mockReturnValueOnce({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
			mockLimit.mockReturnValueOnce(Promise.resolve([]));

			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce({ innerJoin: mockInnerJoin });
			mockInnerJoin.mockReturnValueOnce({ where: mockWhere });
			mockWhere.mockReturnValueOnce({ groupBy: mockGroupBy });
			mockGroupBy.mockReturnValueOnce({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
			mockLimit.mockReturnValueOnce(Promise.resolve([]));

			mockSelect.mockReturnValueOnce({ from: mockFrom });
			mockFrom.mockReturnValueOnce(Promise.resolve([{ last24h: 0, last7d: 0, last30d: 0 }]));

			(db.select as any) = mockSelect;

			// first call - should hit database
			const result1 = await getPasteStatistics(mockAdminUser);
			expect(result1.ok).toBe(true);

			// second call - should use cache
			const result2 = await getPasteStatistics(mockAdminUser);
			expect(result2.ok).toBe(true);

			// verify db.select was only called 5 times (once for initial load, not again for cache hit)
			expect(mockSelect).toHaveBeenCalledTimes(5);
		});

		it('should handle database errors gracefully', async () => {
			const mockSelect = vi.fn();
			mockSelect.mockReturnValue({
				from: vi.fn().mockRejectedValue(new Error('Database connection failed')),
			});

			(db.select as any) = mockSelect;

			const result = await getPasteStatistics(mockAdminUser);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				// the implementation catches errors and re-throws them, preserving original message
				expect(result.error.message).toBeTruthy();
			}
		});
	});

	describe('getUserStats', () => {
		it('should return total user count', async () => {
			const mockResult = [{ count: 150 }];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();

			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue(Promise.resolve(mockResult));

			(db.select as any) = mockSelect;

			const result = await getUserStats(mockAdminUser);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalUsers).toBe(150);
			}
		});

		it('should handle zero users', async () => {
			const mockResult = [{ count: 0 }];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();

			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue(Promise.resolve(mockResult));

			(db.select as any) = mockSelect;

			const result = await getUserStats(mockAdminUser);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalUsers).toBe(0);
			}
		});

		it('should use cached data on subsequent calls', async () => {
			const mockResult = [{ count: 150 }];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();

			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue(Promise.resolve(mockResult));

			(db.select as any) = mockSelect;

			// first call
			const result1 = await getUserStats(mockAdminUser);
			expect(result1.ok).toBe(true);

			// second call - should use cache
			const result2 = await getUserStats(mockAdminUser);
			expect(result2.ok).toBe(true);

			// verify select was only called once
			expect(mockSelect).toHaveBeenCalledTimes(1);
		});

		it('should handle database errors', async () => {
			const mockSelect = vi.fn();
			mockSelect.mockReturnValue({
				from: vi.fn().mockRejectedValue(new Error('Connection timeout')),
			});

			(db.select as any) = mockSelect;

			const result = await getUserStats(mockAdminUser);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				// the implementation catches errors and re-throws them, preserving original message
				expect(result.error.message).toBeTruthy();
			}
		});
	});

	describe('getSessionStats', () => {
		it('should return total session count', async () => {
			const mockResult = [{ count: 75 }];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();
			const mockWhere = vi.fn();

			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockReturnValue(Promise.resolve(mockResult));

			(db.select as any) = mockSelect;

			const result = await getSessionStats(mockAdminUser);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalSessions).toBe(75);
			}
		});

		it('should handle zero sessions', async () => {
			const mockResult = [{ count: 0 }];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();
			const mockWhere = vi.fn();

			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockReturnValue(Promise.resolve(mockResult));

			(db.select as any) = mockSelect;

			const result = await getSessionStats(mockAdminUser);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.totalSessions).toBe(0);
			}
		});

		it('should use cached data on subsequent calls', async () => {
			const mockResult = [{ count: 75 }];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();
			const mockWhere = vi.fn();

			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockReturnValue(Promise.resolve(mockResult));

			(db.select as any) = mockSelect;

			// first call
			const result1 = await getSessionStats(mockAdminUser);
			expect(result1.ok).toBe(true);

			// second call - should use cache
			const result2 = await getSessionStats(mockAdminUser);
			expect(result2.ok).toBe(true);

			// verify select was only called once
			expect(mockSelect).toHaveBeenCalledTimes(1);
		});

		it('should handle database errors', async () => {
			const mockSelect = vi.fn();
			const mockFrom = vi.fn();
			const mockWhere = vi.fn();

			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockRejectedValue(new Error('Query failed'));

			(db.select as any) = mockSelect;

			const result = await getSessionStats(mockAdminUser);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toBeTruthy();
			}
		});
	});

	describe('getLastBackupTime', () => {
		it('should return last backup timestamp when available', async () => {
			const mockTimestamp = new Date('2024-01-15T10:30:00Z');
			const mockResult = [{ timestamp: mockTimestamp }];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();
			const mockWhere = vi.fn();
			const mockOrderBy = vi.fn();
			const mockLimit = vi.fn();

			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockReturnValue({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValue({ limit: mockLimit });
			mockLimit.mockReturnValue(Promise.resolve(mockResult));

			(db.select as any) = mockSelect;

			const result = await getLastBackupTime(mockAdminUser);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.lastBackup).toEqual(mockTimestamp);
			}
		});

		it('should return null when no backup found', async () => {
			const mockResult: any[] = [];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();
			const mockWhere = vi.fn();
			const mockOrderBy = vi.fn();
			const mockLimit = vi.fn();

			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockReturnValue({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValue({ limit: mockLimit });
			mockLimit.mockReturnValue(Promise.resolve(mockResult));

			(db.select as any) = mockSelect;

			const result = await getLastBackupTime(mockAdminUser);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.lastBackup).toBeNull();
			}
		});

		it('should use cached data on subsequent calls', async () => {
			const mockTimestamp = new Date('2024-01-15T10:30:00Z');
			const mockResult = [{ timestamp: mockTimestamp }];

			const mockSelect = vi.fn();
			const mockFrom = vi.fn();
			const mockWhere = vi.fn();
			const mockOrderBy = vi.fn();
			const mockLimit = vi.fn();

			mockSelect.mockReturnValue({ from: mockFrom });
			mockFrom.mockReturnValue({ where: mockWhere });
			mockWhere.mockReturnValue({ orderBy: mockOrderBy });
			mockOrderBy.mockReturnValue({ limit: mockLimit });
			mockLimit.mockReturnValue(Promise.resolve(mockResult));

			(db.select as any) = mockSelect;

			// first call
			const result1 = await getLastBackupTime(mockAdminUser);
			expect(result1.ok).toBe(true);

			// second call - should use cache
			const result2 = await getLastBackupTime(mockAdminUser);
			expect(result2.ok).toBe(true);

			// verify select was only called once
			expect(mockSelect).toHaveBeenCalledTimes(1);
		});

		it('should handle database errors', async () => {
			const mockSelect = vi.fn();
			mockSelect.mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						orderBy: vi.fn().mockReturnValue({
							limit: vi.fn().mockRejectedValue(new Error('Query timeout')),
						}),
					}),
				}),
			});

			(db.select as any) = mockSelect;

			const result = await getLastBackupTime(mockAdminUser);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				// the implementation catches errors and re-throws them, preserving original message
				expect(result.error.message).toBeTruthy();
			}
		});
	});
});
