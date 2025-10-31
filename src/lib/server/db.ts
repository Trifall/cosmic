import * as schema from '$database/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from './env';

const DATABASE_URL = getDatabaseUrl();

const driver = postgres(DATABASE_URL);

export const db = drizzle({ client: driver, schema });
