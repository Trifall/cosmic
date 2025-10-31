import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { createChildLogger } from '$src/lib/server/logger';

const logger = createChildLogger('Env');

/**
 * Constructs the PostgreSQL database URL from individual environment variables.
 * This is a server-only function and should never be exposed to the client.
 *
 * For self-contained Docker deployments, most values are hardcoded to standard defaults.
 * Only DB_PASSWORD needs to be configured for security.
 *
 * @returns The constructed DATABASE_URL string
 * @throws Error if required environment variables are missing
 */
export const getDatabaseUrl = (): string => {
	const { dbUser, dbName, dbPort, dbHost, dbSslMode, dbPassword } = getDatabaseEnvVars();

	if (!dbPassword) {
		if (building) {
			// in build mode allow a placeholder so that build does not fail
			// but warn that it must be replaced at runtime
			logger.warn(
				'DB_PASSWORD is missing during build. A placeholder will be used; ensure it is set at runtime.'
			);
			// use a dummy safe string that wont break URL parsing
			return `postgres://${encodeURIComponent(dbUser)}:PLACEHOLDER@${dbHost}:${dbPort}/${dbName}${
				dbSslMode !== 'disable' ? `?sslmode=${dbSslMode}` : ''
			}`;
		} else {
			throw new Error('DB_PASSWORD environment variable is required');
		}
	}

	const userPart = encodeURIComponent(dbUser);
	const passPart = encodeURIComponent(dbPassword);

	const baseUrl = `postgres://${userPart}:${passPart}@${dbHost}:${dbPort}/${dbName}`;

	return dbSslMode !== 'disable' ? `${baseUrl}?sslmode=${dbSslMode}` : baseUrl;
};

export const getDatabaseEnvVars = () => {
	const dbUser = process.env.DB_USER ?? env.DB_USER ?? 'postgres';
	const dbName = process.env.DB_NAME ?? env.DB_NAME ?? 'cosmic';
	const dbPort = process.env.DB_PORT ?? env.DB_PORT ?? '5432';

	const dbHostFromProcess =
		process.env.DB_HOST && process.env.DB_HOST.length > 0 ? process.env.DB_HOST : undefined;
	const dbHostFromEnv = env.DB_HOST && env.DB_HOST.length > 0 ? env.DB_HOST : undefined;
	const dbHost = dbHostFromProcess ?? dbHostFromEnv ?? 'db';

	const dbSslMode = process.env.DB_SSLMODE ?? env.DB_SSLMODE ?? 'disable';

	// only read password — do not default it to anything aside from undefined
	const dbPassword =
		process.env.DB_PASSWORD ??
		(env.DB_PASSWORD && env.DB_PASSWORD.length > 0 ? env.DB_PASSWORD : undefined);

	// warn if critical vars are missing (except password, handled above)
	const missing = [];
	if (!process.env.DB_USER && !env.DB_USER) missing.push('DB_USER');
	if (!process.env.DB_NAME && !env.DB_NAME) missing.push('DB_NAME');
	if (!process.env.DB_PORT && !env.DB_PORT) missing.push('DB_PORT');
	if (!process.env.DB_HOST && !env.DB_HOST) missing.push('DB_HOST');
	if (missing.length > 0) {
		logger.info(`Using default values for missing database vars: ${missing.join(', ')}`);
	}

	// when logging mask the password
	logger.debug(
		`Database config: ${JSON.stringify(
			{
				dbUser,
				dbName,
				dbPort,
				dbHost,
				dbSslMode,
				dbPassword: dbPassword ? '*[REDACTED]*' : undefined,
			},
			null,
			2
		)}`
	);

	return { dbUser, dbName, dbPort, dbHost, dbSslMode, dbPassword };
};

/**
 * Parses a database URL and returns individual connection parameters.
 * Useful for tools like pg_dump that need separate parameters.
 *
 * @param databaseUrl - The database URL to parse
 * @returns Object containing connection parameters
 */
export const parseDatabaseUrl = (databaseUrl: string) => {
	// use the URL constructor which handles percent-decoding
	const url = new URL(databaseUrl);

	return {
		host: url.hostname,
		port: url.port || '5432',
		username: url.username,
		password: url.password,
		database: url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname,
		sslmode: url.searchParams.get('sslmode') ?? undefined,
	};
};
