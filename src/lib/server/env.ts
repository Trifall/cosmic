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
	const { dbUser, dbName, dbPort, dbHost, dbSslMode } = getDatabaseEnvVars();

	// only password is required
	let dbPassword = env.DB_PASSWORD;
	if (!dbPassword) {
		if (building) {
			dbPassword = 'build-time-password-will-be-replaced-at-runtime';
		} else {
			throw new Error('DB_PASSWORD environment variable is required');
		}
	}

	// construct the database URL
	const baseUrl = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

	// add SSL mode if not disable
	if (dbSslMode !== 'disable') {
		return `${baseUrl}?sslmode=${dbSslMode}`;
	}

	return baseUrl;
};

export const getDatabaseEnvVars = () => {
	// warn if any of the required environment variables are missing
	const requiredVars = ['DB_USER', 'DB_NAME', 'DB_PORT', 'DB_HOST', 'DB_PASSWORD'];
	const missingVars = requiredVars.filter((varName) => !env[varName]);

	if (missingVars.length > 0) {
		logger.info(`Using default values for variables: ${missingVars.join(', ')}. `);
	}

	// resort to default values if any are missing
	const dbUser = env.DB_USER || 'postgres';
	const dbName = env.DB_NAME || 'cosmic';
	const dbPort = env.DB_PORT || '5432';
	const dbHost = env.DB_HOST || 'localhost';
	const dbSslMode = env.DB_SSLMODE || 'disable';
	const dbPassword = env.DB_PASSWORD;

	// track which variables are using defaults
	const usingDefaults = [];
	if (!env.DB_USER) usingDefaults.push('DB_USER -> postgres');
	if (!env.DB_NAME) usingDefaults.push('DB_NAME -> cosmic');
	if (!env.DB_PORT) usingDefaults.push('DB_PORT -> 5432');
	if (!env.DB_HOST) usingDefaults.push('DB_HOST -> localhost');

	// log the configuration
	logger.debug(
		`Database configuration: ${JSON.stringify(
			{
				dbUser,
				dbName,
				dbPort,
				dbHost,
				dbPassword: dbPassword ? '*Set*' : undefined,
				...(usingDefaults.length > 0 && { defaultsUsed: usingDefaults }),
			},
			null,
			2
		)}`
	);

	return {
		dbUser,
		dbName,
		dbPort,
		dbHost,
		dbPassword,
		dbSslMode,
	};
};

/**
 * Parses a database URL and returns individual connection parameters.
 * Useful for tools like pg_dump that need separate parameters.
 *
 * @param databaseUrl - The database URL to parse
 * @returns Object containing connection parameters
 */
export const parseDatabaseUrl = (databaseUrl: string) => {
	const url = new URL(databaseUrl);

	return {
		host: url.hostname,
		port: url.port || '5432',
		username: url.username,
		password: url.password,
		database: url.pathname.slice(1), // remove leading slash
	};
};
