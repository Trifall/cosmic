/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DBUser } from '@/database/schema';
import { USERNAME_PLACEHOLDER } from '@/src/lib/auth/user-management';
import { describe, expect, it } from 'vitest';
import {
	formatDate,
	formatEmailFromUserObject,
	formatUserName,
	formatUserNameInitials,
} from './format';

describe('Format Utils', () => {
	// create properly typed mock data for testing
	const mockDBUser: DBUser = {
		id: '1',
		username: 'testuser',
		displayUsername: 'Test User',
		name: 'Test Name',
		email: 'test@example.com',
		emailVerified: true,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		role: 'user',
		banned: false,
		banReason: null,
		banExpires: null,
	};

	const mockDBUserWithPlaceholderEmail: DBUser = {
		id: '2',
		username: 'placeholderuser',
		displayUsername: 'Placeholder User',
		name: 'Placeholder Name',
		email: `placeholder${USERNAME_PLACEHOLDER}`,
		emailVerified: true,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		role: 'user',
		banned: false,
		banReason: null,
		banExpires: null,
	};

	const mockPartialUser: Partial<DBUser> = {
		id: '3',
		username: 'partialuser',
	};

	const mockEmptyUser: Partial<DBUser> = {
		id: '4',
	};

	describe('formatUserName', () => {
		it('should format a DBUser name correctly', () => {
			expect(formatUserName(mockDBUser)).toBe('Test User');
		});

		it('should format a DBUser with fallbacks correctly', () => {
			// creating properly typed test objects
			const userWithoutDisplayName: DBUser = {
				...mockDBUser,
				displayUsername: null,
			};
			expect(formatUserName(userWithoutDisplayName)).toBe('testuser');

			// for the username test, we need to use a type assertion since username is required
			// this is acceptable for testing the fallback behavior
			// note: the implementation treats empty strings differently than null/undefined
			const userWithoutUsername = {
				...mockDBUser,
				displayUsername: null,
				username: undefined as any, // using undefined to trigger the fallback
			} as unknown as DBUser;
			expect(formatUserName(userWithoutUsername)).toBe('Test Name');

			// for the name test, we need to use a type assertion since name is required
			const userWithNoNames = {
				...mockDBUser,
				displayUsername: null,
				username: undefined as any, // using undefined to trigger the fallback
				name: undefined as any, // using undefined to trigger the fallback
			} as unknown as DBUser;
			expect(formatUserName(userWithNoNames)).toBe('Unknown');
		});

		it('should handle partial user objects', () => {
			expect(formatUserName(mockPartialUser)).toBe('Unknown');
			expect(formatUserName(mockEmptyUser)).toBe('Unknown');
		});
	});

	describe('formatEmail', () => {
		it('should format a DBUser email correctly', () => {
			expect(formatEmailFromUserObject(mockDBUser)).toBe('test@example.com');
		});

		it('should return null for DBUser with placeholder email', () => {
			expect(formatEmailFromUserObject(mockDBUserWithPlaceholderEmail)).toBe(null);
		});

		it('should handle partial user objects', () => {
			const partialUserWithEmail: Partial<DBUser> = {
				email: 'partial@example.com',
			};
			expect(formatEmailFromUserObject(partialUserWithEmail)).toBe(null);

			const partialUserWithPlaceholderEmail: Partial<DBUser> = {
				email: `partial${USERNAME_PLACEHOLDER}`,
			};
			expect(formatEmailFromUserObject(partialUserWithPlaceholderEmail)).toBe(null);

			expect(formatEmailFromUserObject(mockEmptyUser)).toBe(null);
		});

		it('should handle undefined email values', () => {
			// for the email test, we need to use a type assertion since email is required
			const userWithUndefinedEmail = {
				...mockDBUser,
				email: undefined as any, // using undefined to trigger the null return
			} as unknown as DBUser;
			expect(formatEmailFromUserObject(userWithUndefinedEmail)).toBe(null);
		});
	});

	describe('formatUserNameInitials', () => {
		it('should format a DBUser initials correctly', () => {
			expect(formatUserNameInitials(mockDBUser)).toBe('TU');
		});

		it('should handle multi-word names correctly', () => {
			const multiWordUser: DBUser = {
				...mockDBUser,
				displayUsername: 'John Doe Smith',
			};
			expect(formatUserNameInitials(multiWordUser)).toBe('JDS');
		});

		it('should handle partial user objects', () => {
			expect(formatUserNameInitials(mockPartialUser)).toBe('U');
			expect(formatUserNameInitials(mockEmptyUser)).toBe('U');
		});

		it('should handle empty strings and single characters', () => {
			const userWithSingleChar: DBUser = {
				...mockDBUser,
				displayUsername: 'A',
			};
			expect(formatUserNameInitials(userWithSingleChar)).toBe('A');

			// for testing with empty strings, we need to use a type assertion
			// our implementation now returns empty string for empty names
			const userWithEmptyName = {
				...mockDBUser,
				displayUsername: '',
				username: '',
				name: '',
			} as unknown as DBUser;
			// with our updated implementation, this will return an empty string
			expect(formatUserNameInitials(userWithEmptyName)).toBe('');
		});
	});

	// test for the private containsPlaceholderEmail function indirectly through formatEmail
	describe('containsPlaceholderEmail (indirectly)', () => {
		it('should detect placeholder emails correctly', () => {
			const userWithPlaceholder: DBUser = {
				...mockDBUser,
				email: `test${USERNAME_PLACEHOLDER}`,
			};
			expect(formatEmailFromUserObject(userWithPlaceholder)).toBe(null);

			const userWithoutPlaceholder: DBUser = {
				...mockDBUser,
				email: 'test@example.com',
			};
			expect(formatEmailFromUserObject(userWithoutPlaceholder)).toBe('test@example.com');
		});
	});

	describe('formatDate', () => {
		it('should format a date correctly', () => {
			expect(formatDate('2022-01-01')).toBe('1/1/2022');
		});

		it('should return N/A for null date', () => {
			expect(formatDate(null as any)).toBe('N/A');
		});
	});
});
