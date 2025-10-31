import { defineConfig } from 'drizzle-kit';

// construct database URL from environment variables with sensible defaults
const dbUser = process.env.DB_USER || 'postgres';
const dbName = process.env.DB_NAME || 'cosmic';
const dbPort = process.env.DB_PORT || '5432';
const dbHost = process.env.DB_HOST || 'localhost';
const dbSslMode = process.env.DB_SSLMODE || 'disable';

// only password is required
const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) throw new Error('DB_PASSWORD is required');

const baseUrl = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
const DATABASE_URL = dbSslMode !== 'disable' ? `${baseUrl}?sslmode=${dbSslMode}` : baseUrl;

export default defineConfig({
	out: './drizzle',
	schema: './schema',
	dbCredentials: {
		url: DATABASE_URL,
	},
	verbose: true,
	strict: true,
	dialect: 'postgresql',
});
