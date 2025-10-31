import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGES, signInSchema, signUpSchema } from '$lib/shared/auth';

describe('Auth Schemas', () => {
	describe('signInSchema', () => {
		it('should validate valid username and password', () => {
			const validData = {
				username: 'Test1234',
				password: 'ValidP@ssw0rd',
			};
			const result = signInSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject invalid username', () => {
			const invalidData = {
				username: 'not-an!!email',
				password: 'ValidP@ssw0rd',
			};
			const result = signInSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].path[0]).toBe('username');
			}
		});

		it('should reject XSS attempts in username', () => {
			const xssData = {
				username: 'test<script>alert("xss")</script>',
				password: 'ValidP@ssw0rd',
			};
			const result = signInSchema.safeParse(xssData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe('Invalid characters detected');
			}
		});

		it('should reject weak passwords with generic message', () => {
			const testCases = [
				{ password: 'short' },
				{ password: 'nouppercase1!' },
				{ password: 'NOLOWERCASE1!' },
				{ password: 'NoNumbers!' },
				{ password: 'NoSpecial1' },
			];

			testCases.forEach((testCase) => {
				const result = signInSchema.safeParse({
					username: 'Test1234',
					password: testCase.password,
				});
				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.issues[0].message).toBe('Invalid password');
				}
			});
		});
	});

	describe('signUpSchema', () => {
		const validData = {
			username: 'validuser',
			email: 'test@example.com',
			password: 'ValidP@ssw0rd',
			password_confirmation: 'ValidP@ssw0rd',
		};

		it('should validate valid signup data', () => {
			const result = signUpSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject invalid username characters', () => {
			const invalidUsernames = ['user@name', 'user name', 'user<script>', 'user;drop table'];

			invalidUsernames.forEach((username) => {
				const result = signUpSchema.safeParse({ ...validData, username });
				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.issues[0].path[0]).toBe('username');
				}
			});
		});

		it('should reject usernames that are too short or too long', () => {
			const invalidUsernames = [
				'ab', // too short
				'a'.repeat(51), // too long
			];

			invalidUsernames.forEach((username) => {
				const result = signUpSchema.safeParse({ ...validData, username });
				expect(result.success).toBe(false);
			});
		});

		it('should show detailed password requirements during signup', () => {
			const testCases = [
				{ password: 'short', message: 'Password must be at least 8 characters' },
				{
					password: 'nouppercase1!',
					message: 'Password must contain at least one uppercase letter',
				},
				{
					password: 'NOLOWERCASE1!',
					message: 'Password must contain at least one lowercase letter',
				},
				{ password: 'NoNumbers!', message: 'Password must contain at least one number' },
				{ password: 'NoSpecial1', message: 'Password must contain at least one special character' },
			];

			testCases.forEach((testCase) => {
				const result = signUpSchema.safeParse({
					...validData,
					password: testCase.password,
					password_confirmation: testCase.password,
				});
				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.issues[0].message).toBe(testCase.message);
				}
			});
		});

		it('should reject when passwords do not match', () => {
			const data = {
				...validData,
				password_confirmation: 'DifferentP@ssw0rd',
			};
			const result = signUpSchema.safeParse(data);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe('Passwords dont match');
			}
		});

		it('should trim whitespace from email and username', () => {
			const data = {
				...validData,
				username: '  validuser  ',
				email: '  test@example.com  ',
			};
			const result = signUpSchema.safeParse(data);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.username).toBe('validuser');
				expect(result.data.email).toBe('test@example.com');
			}
		});

		it('should reject SQL injection attempts', () => {
			const sqlInjectionData = {
				...validData,
				username: "robert'; DROP TABLE users; --",
				email: "admin@example.com'; DROP TABLE users; --",
			};
			const result = signUpSchema.safeParse(sqlInjectionData);
			expect(result.success).toBe(false);
		});
	});

	describe('ERROR_MESSAGES', () => {
		it('should have the correct error messages', () => {
			expect(ERROR_MESSAGES.EMAIL_EXISTS).toBe('An account with this email already exists');
			expect(ERROR_MESSAGES.USERNAME_EXISTS).toBe('An account with this username already exists');
			expect(ERROR_MESSAGES.INVALID_PASSWORD).toBe('Invalid login credentials');
			expect(ERROR_MESSAGES.UNKNOWN).toBe('An unknown error occurred. Please try again.');
		});
	});
});
