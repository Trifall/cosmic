import { defineConfig } from 'drizzle-kit';

// construct database URL from environment variables with sensible defaults
const dbUser = process.env.DB_USER || 'postgres';
const dbName = process.env.DB_NAME || 'cosmic';
const dbPort = process.env.DB_PORT || '5432';
const dbHost = process.env.DB_HOST || 'db';
const dbSslMode = process.env.DB_SSLMODE || 'disable';

// only password is required
const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) throw new Error('DB_PASSWORD is required');

export default defineConfig({
	// from root level
	out: './database/drizzle',
	schema: './database/schema',
	dbCredentials: {
		host: dbHost,
		port: Number(dbPort),
		user: dbUser,
		password: dbPassword,
		database: dbName,
		ssl: dbSslMode !== 'disable',
	},
	verbose: true,
	strict: true,
	dialect: 'postgresql',
});
