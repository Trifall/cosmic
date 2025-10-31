import { vi } from 'vitest';

// mock the drizzle query builder structure used in tests
export const db = {
	query: {
		userProfiles: {
			findFirst: vi.fn(),
		},
		roles: {
			findFirst: vi.fn(),
		},
		permissions: {
			findFirst: vi.fn(),
		},
		rolePermissions: {
			findFirst: vi.fn(),
		},
		userPermissions: {
			findFirst: vi.fn(),
		},
	},
	select: vi.fn(() => ({
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue([]),
	})),
	insert: vi.fn(() => ({
		values: vi.fn().mockReturnThis(),
		onConflictDoNothing: vi.fn().mockReturnThis(),
		returning: vi.fn().mockResolvedValue([{}]),
	})),
	update: vi.fn(() => ({
		set: vi.fn().mockReturnThis(),
		where: vi.fn().mockResolvedValue([]),
	})),
	transaction: vi.fn(async (callback) => {
		return await callback(db);
	}),
};
