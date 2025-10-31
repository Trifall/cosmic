import type { DBUser } from '$database/schema';
import { env } from '$env/dynamic/public';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import type { ZodError } from 'zod';
import { USERNAME_PLACEHOLDER } from '$src/lib/auth/user-management';
import type { ExpiryEnumValue } from '$src/lib/shared/settings';

/**
 * Calculates the expiresAt timestamp based on the expiry value
 * @param expiryValue - Expiry value
 * @returns expiresAt timestamp
 */
export const calculateExpiresAt = (expiryValue: ExpiryEnumValue): Date | null => {
	if (expiryValue === 'never' || !expiryValue) {
		return null;
	}
	const now = new Date();
	let expiresAt: Date = now;
	switch (expiryValue) {
		case '10m':
			expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
			break;
		case '1h':
			expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
			break;
		case '1d':
			expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
			break;
		case '1w':
			expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
			break;
		case '1M':
			expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
			break;
		case '1y':
			expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
			break;
	}
	return expiresAt;
};

export const getPublicSiteName = () => {
	return env.PUBLIC_SITE_NAME && env.PUBLIC_SITE_NAME.length > 0 ? env.PUBLIC_SITE_NAME : 'Cosmic';
};

/**
 * Checks if the user is an unauthenticated user
 * @param user - User object
 * @returns true if the user is an unauthenticated user, false otherwise
 */
export const isUnauthenticatedUser = (user: DBUser | Partial<DBUser> | null): user is null => {
	return !user || !('id' in user);
};

/**
 * Checks if the user is a database user
 * @param user - User object
 * @returns true if the user is a database user, false otherwise
 */
export const isDBUser = (user: DBUser | Partial<DBUser> | null): boolean => {
	return !!user && 'role' in user && 'id' in user && !!user.id && user?.id.length > 0;
};

/**
 * Formats the user name based on the user type
 * @param user - User object
 * @returns formatted user name
 */
export const formatUserName = (user: DBUser | Partial<DBUser>) => {
	if (isDBUser(user)) {
		return user.displayUsername ?? user.username ?? user.name ?? 'Unknown';
	}

	if (isUnauthenticatedUser(user)) {
		return 'Guest';
	}

	return 'Unknown';
};

/**
 * Checks if the email contains a placeholder
 * @param email - Email address
 * @returns true if the email contains a placeholder, false otherwise
 */
const containsPlaceholderEmail = (email: string) => {
	return email.includes(USERNAME_PLACEHOLDER);
};

export const formatEmail = (email: string | undefined) => {
	if (!email || containsPlaceholderEmail(email)) {
		return '';
	}

	return email;
};

/**
 * Formats the user email based on the user type
 * @param user - User object
 * @returns formatted user email or null if the email is a placeholder
 */
export const formatEmailFromUserObject = (user: DBUser | Partial<DBUser>): string | null => {
	if (isDBUser(user)) {
		if (containsPlaceholderEmail(user?.email ?? '')) {
			return null;
		}
		return user?.email ?? null;
	}

	if (isUnauthenticatedUser(user)) {
		return null;
	}

	return null;
};

/**
 * Formats the user name initials based on the user type
 * @param user - User object
 * @returns formatted user name initials
 */
export const formatUserNameInitials = (user: DBUser | Partial<DBUser>) => {
	const name = formatUserName(user);

	if (!name || name.trim() === '') {
		return '';
	}

	return name
		.split(' ')
		.filter((word: string) => word.length > 0)
		.map((word: string) => word[0]?.toUpperCase() || '')
		.join('');
};

/**
 * Formats the server uptime
 * @param ms - Uptime in milliseconds
 * @returns formatted uptime string
 */
export const formatUptime = (ms: number): string => {
	const seconds = Math.floor(ms / 1000);
	const days = Math.floor(seconds / (24 * 60 * 60));
	const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
	const minutes = Math.floor((seconds % (60 * 60)) / 60);
	const remainingSeconds = Math.floor(seconds % 60);

	let formatted = '';
	if (days > 0) {
		formatted += `${days}d `;
	}
	if (hours > 0 || days > 0) {
		formatted += `${hours}h `;
	}
	if (minutes > 0 || hours > 0 || days > 0) {
		formatted += `${minutes}m `;
	}
	formatted += `${remainingSeconds}s`;

	return formatted;
};

/**
 * Formats the JSON data for display
 * @param json - JSON data
 * @returns formatted string
 */
export const formatJSON = (json: unknown): string => {
	if (!json) return 'No data';
	try {
		// add proper indentation for JSON display and remove brackets
		const jsonString = JSON.stringify(json, null, 2);
		// remove first and last lines (opening and closing brackets)
		const lines = jsonString.split('\n');
		// if its just brackets, return the content without brackets
		if (lines.length <= 2) {
			return jsonString.slice(1, -1).trim();
		}
		// for multi-line JSON, remove first and last lines and adjust indentation
		const contentLines = lines.slice(1, -1);
		// remove 2 spaces of indentation from each line
		return contentLines.map((line) => line.substring(2)).join('\n');
	} catch (e: unknown) {
		console.error('Error formatting JSON:', e);
		return 'Invalid JSON data';
	}
};

/**
 * Formats the date for display
 * @param date - Date string or Date object
 * @returns formatted date string in long format (e.g. January 1, 2025)
 */
export const formatFormalDate = (date: Date | string): string => {
	return new Date(date).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
};

/*
 * Formats the date relative to now
 * @param date - Date string or Date object
 * @returns formatted date string relative to now (e.g. 2 days ago, yesterday, today, etc.)
 */
export const formatRelativeTime = (date: Date | string | null): string => {
	if (!date) return 'Never';
	const now = new Date();
	const target = new Date(date);

	// handle invalid dates
	if (isNaN(target.getTime())) return 'Unknown';

	const diffInMs = now.getTime() - target.getTime();
	const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

	// handle future dates (clock sync issues, timezone problems, etc.)
	if (diffInDays < 0) return 'Today';

	if (diffInDays === 0) return 'Today';
	if (diffInDays === 1) return 'Yesterday';
	if (diffInDays < 7) return `${diffInDays} days ago`;
	if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
	if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
	return `${Math.floor(diffInDays / 365)} years ago`;
};

/**
 * Formats the date relative to now
 * @param date - Date string or Date object
 * @returns formatted date string relative to now
 */
export const formatDateRelativeToNow = (date: string | Date): string => {
	const d = typeof date === 'string' ? new Date(date) : date;
	return formatDistanceToNow(d, { addSuffix: true });
};

/**
 * Formats the date for display
 * @param date - Date string or Date object
 * @returns formatted date string in MM/DD/YYYY format
 */
export const formatDate = (date: string | Date) => {
	if (!date) return 'N/A';
	// create a date object, ensuring proper handling of date strings
	const dateObj = new Date(date);
	// force UTC interpretation to avoid timezone issues
	dateObj.setTime(dateObj.getTime() + dateObj.getTimezoneOffset() * 60 * 1000);
	// format as M/D/YYYY to match test expectations
	const month = dateObj.getMonth() + 1; // getMonth() is zero-indexed
	const day = dateObj.getDate();
	const year = dateObj.getFullYear();
	return `${month}/${day}/${year}`;
};

export const capitalizeFirstLetter = (val: string | null | undefined) => {
	if (!val) return '';
	return String(val).charAt(0).toUpperCase() + String(val).slice(1);
};

/**
 * Processes Zod validation errors into a fieldErrors format compatible with SvelteKit forms
 * Replaces the deprecated .flatten() method from Zod 3
 *
 * @param zodError - The ZodError from a failed safeParse
 * @returns Record<string, string[]> - Field errors in the same format as the old flatten().fieldErrors
 */
export const processZodErrors = (zodError: ZodError): Record<string, string[]> => {
	const fieldErrors: Record<string, string[]> = {};

	zodError.issues.forEach((issue) => {
		if (issue.path[0] && (typeof issue.path[0] === 'string' || typeof issue.path[0] === 'number')) {
			const field = issue.path[0].toString();
			if (!fieldErrors[field]) fieldErrors[field] = [];
			fieldErrors[field].push(issue.message);
		}
	});

	return fieldErrors;
};

export const formatPasteStatusError = (error: unknown) => {
	if (error instanceof Response) {
		return error;
	}

	// check for status property first
	const errorWithStatus = error as {
		status?: number;
		message?: string;
		body?: { message?: string };
	};
	if (errorWithStatus.status) {
		if (errorWithStatus.status === 401) {
			return {
				status: 401,
				message:
					errorWithStatus?.message || errorWithStatus?.body?.message || 'Authentication required',
			};
		} else if (errorWithStatus.status === 403) {
			return {
				status: 403,
				message: errorWithStatus?.message || errorWithStatus?.body?.message || 'Access denied',
			};
		} else if (errorWithStatus.status === 404) {
			return {
				status: 404,
				message: errorWithStatus?.message || errorWithStatus?.body?.message || 'Paste not found',
			};
		} else {
			return {
				status: errorWithStatus.status,
				message:
					errorWithStatus?.message || errorWithStatus?.body?.message || 'Internal server error',
			};
		}
	}

	// check for message property to infer status
	const errorWithMessage = error as { message?: string };
	if (errorWithMessage.message) {
		const message = errorWithMessage.message.toLowerCase();
		if (message.includes('not found') || message.includes('404')) {
			return { status: 404, message: errorWithMessage.message };
		} else if (message.includes('authentication') || message.includes('401')) {
			return { status: 401, message: errorWithMessage.message };
		} else if (
			message.includes('access denied') ||
			message.includes('forbidden') ||
			message.includes('403')
		) {
			return { status: 403, message: errorWithMessage.message };
		}
	}

	// default to 500 internal server error
	return { status: 500, message: 'Internal server error' };
};

/**
 * Sanitizes a filename by removing path separators and invalid characters
 * @param fileName - The filename to sanitize
 * @param extension - The extension to add to the filename
 * @param maxLength - The maximum length of the filename
 * @returns sanitized filename
 * @throws Error if the filename is invalid or too long
 */
export const sanitizeFilename = (
	fileName: string,
	extension?: string,
	maxLength?: number
): string => {
	if (!fileName || fileName.length === 0) return '';
	// sanitize filename: remove path separators and invalid characters
	let sanitizedFileName = fileName
		.replace(/[\/\\]/g, '_') // replace path separators
		.replace(/[^\w\-_.]/g, '_') // replace invalid chars
		.replace(/_+/g, '_') // collapse multiple underscores
		.replace(/^_+|_+$/g, ''); // remove leading/trailing underscores

	if (maxLength && sanitizedFileName.length > maxLength) {
		sanitizedFileName = sanitizedFileName.slice(0, maxLength);
	}

	if (extension) {
		sanitizedFileName += extension;
	}

	return sanitizedFileName;
};
