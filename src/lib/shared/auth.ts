import * as z from 'zod';

export const secureString = z
	.string()
	.trim()
	.min(1, 'This field cannot be empty')
	.regex(/^[^<>"'`;\\/]*$/, 'Invalid characters detected');

export const secureUsername = secureString
	.min(3, 'Username must be at least 3 characters')
	.max(50, 'Username is too long')
	.regex(/^[a-zA-Z0-9_-]*$/, 'Username can only contain letters, numbers, underscores, and hyphens')
	.refine(
		(value) => {
			const trimmedValue = value.toLowerCase().trim();
			return (
				trimmedValue !== 'admin' &&
				trimmedValue !== 'root' &&
				trimmedValue !== 'moderator' &&
				trimmedValue !== 'user' &&
				trimmedValue !== 'guest' &&
				trimmedValue !== 'unauthenticated' &&
				trimmedValue !== 'administrator' &&
				trimmedValue !== 'owner'
			);
		},
		{
			message: 'Username is not allowed',
		}
	);

// validation for search queries - allows spaces and more characters but blocks dangerous ones
export const secureSearchQuery = z
	.string()
	.trim()
	.min(1, 'Search query cannot be empty')
	.max(100, 'Search query is too long')
	.regex(/^[^<>"'`;\\/]*$/, 'Search query contains unsafe characters');

// allow empty email or valid email format
export const secureEmail = z.union([
	z.literal(''),
	z
		.string()
		.trim()
		.min(1, 'Email is required if provided')
		.max(80, 'Email is too long')
		.regex(/^[^<>"'`;\\\/]*$/, 'Invalid characters detected')
		.pipe(z.email('Please enter a valid email address')),
]);

const securePasswordSignIn = z
	.string()
	.min(8, 'Invalid password')
	.max(32, 'Invalid password')
	.regex(/^[^<>"'`;\/]*$/, 'Invalid password')
	.regex(/.*[A-Z].*/, 'Invalid password')
	.regex(/.*[a-z].*/, 'Invalid password')
	.regex(/.*\d.*/, 'Invalid password')
	.regex(/.*[!@#$%^&*()_+\-=\\[\]{};\\':\"\\|,.<>\\/?].*/, 'Invalid password');

export const securePasswordSignUp = z
	.string()
	.min(8, 'Password must be at least 8 characters')
	.max(32, 'Password is too long')
	.regex(/^[^<>"'`;\\/]*$/, 'Invalid characters detected')
	.regex(/.*[A-Z].*/, 'Password must contain at least one uppercase letter')
	.regex(/.*[a-z].*/, 'Password must contain at least one lowercase letter')
	.regex(/.*\d.*/, 'Password must contain at least one number')
	.regex(
		/.*[!@#$%^&*()_+\-=\\[\]{};\':\"\\|,.<>\\/?].*/,
		'Password must contain at least one special character'
	);

export const signInSchema = z.object({
	username: secureUsername,
	password: securePasswordSignIn,
});

export const signUpSchema = z
	.object({
		username: secureUsername,
		email: secureEmail, // can be empty string or valid email; field must be present
		password: securePasswordSignUp,
		password_confirmation: securePasswordSignUp,
	})
	.refine((data) => data.password === data.password_confirmation, {
		message: 'Passwords dont match',
		path: ['password_confirmation'],
	});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

export const ERROR_MESSAGES = {
	EMAIL_EXISTS: 'An account with this email already exists',
	USERNAME_EXISTS: 'An account with this username already exists',
	INVALID_PASSWORD: 'Invalid login credentials',
	UNKNOWN: 'An unknown error occurred. Please try again.',
	INVALID_EMAIL: 'Please enter a valid email address',
	USERNAME_NOT_FOUND: 'User not found',
	BANNED_USER: 'Your account has been banned',
	USERNAME_NOT_ALLOWED: 'Username is already taken',
};
