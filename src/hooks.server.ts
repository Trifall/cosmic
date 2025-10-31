import type { DBUser } from '@/database/schema';
import { createChildLogger } from '@/src/lib/server/logger';
import { type Handle, isRedirect, redirect } from '@sveltejs/kit';
import type { HandleValidationError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { readFile } from 'fs/promises';
import { join } from 'path';
import postgres from 'postgres';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { BackupScheduler } from '$lib/server/backups/backup-scheduler';
import { PasteCleanupScheduler } from '$lib/server/pastes/cleanup-scheduler';
import { rateLimitService } from '$lib/server/rate-limit';
import { getSetting } from '$lib/server/settings';
import { RoleNames } from '$src/lib/auth/roles-shared';
import { ROUTES } from '$src/lib/routes';

const logger = createChildLogger('Hooks');

/**
 * Setup database search triggers
 * This allows for improved searching of pastes (full text search)
 */
const setupDatabase = async () => {
	const setupLogger = createChildLogger('DatabaseSetup');
	const { getDatabaseUrl } = await import('$lib/server/env');

	setupLogger.info('Initializing database setup...');

	const sql = postgres(getDatabaseUrl(), {
		onnotice: () => {}, // ignore notices
	});

	try {
		const triggersSQL = await readFile(
			join(process.cwd(), 'database', 'triggers', 'search-triggers.sql'),
			'utf-8'
		);

		await sql.unsafe(triggersSQL);
		setupLogger.info('Database setup completed: search triggers applied');
	} catch (error) {
		const errorMessage = (error as Error)?.message?.toLowerCase() ?? '';
		if (errorMessage.includes('already exists')) {
			setupLogger.debug('Search triggers already exist, skipping');
		} else {
			setupLogger.error('Failed to setup database triggers', error);
			throw error;
		}
	} finally {
		await sql.end();
	}
};

// server startup tasks (only when not building)
if (!building) {
	const isBun = typeof Bun !== 'undefined' || !!process.versions.bun;
	if (isBun) {
		logger.debug('Bun detected!');
	}

	/*
	 * sequential service initialization
	 * database -> settings -> rate limiting -> backups -> paste cleanup
	 */
	(async () => {
		try {
			logger.info('Step 1: Setting up database...');
			await setupDatabase();
			logger.info('Database setup completed');

			logger.info('Step 2: Initializing settings service...');
			const { settingsService } = await import('$lib/server/settings');
			await settingsService.get('firstTimeSetupCompleted'); // This triggers initialization
			logger.info('Settings service initialized');

			logger.info('Step 3: Initializing rate limiting service...');
			await rateLimitService.initialize();
			logger.info('Rate limiting service initialized');

			logger.info('Step 4: Starting backup scheduler...');
			const backupScheduler = BackupScheduler.getInstance();
			await backupScheduler.start();
			logger.info('Backup scheduler started');

			logger.info('Step 5: Starting paste cleanup scheduler...');
			const cleanupScheduler = PasteCleanupScheduler.getInstance();
			await cleanupScheduler.start();
			logger.info('Paste cleanup scheduler started successfully, running initial cleanup...');
			await cleanupScheduler.triggerCleanup();

			logger.info('All services initialized successfully');
		} catch (error) {
			logger.error(`Fatal: Failed to initialize services: ${error}`);
			process.exit(1);
		}
	})();
}

export const handle: Handle = sequence(
	// setup redirect middleware - check if first-time setup is completed
	async ({ event, resolve }) => {
		// skip during build process
		if (building) {
			return resolve(event);
		}

		const url = new URL(event.request.url);

		// allow access to setup page itself and API routes
		if (url.pathname === '/setup' || url.pathname.startsWith('/api/')) {
			return resolve(event);
		}

		// allow access to static assets
		if (
			url.pathname.startsWith('/_app/') ||
			url.pathname.startsWith('/static/') ||
			url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|ico|webp|gif)$/)
		) {
			return resolve(event);
		}

		// check if setup is completed
		try {
			const setupCompleted = await getSetting('firstTimeSetupCompleted');

			if (!setupCompleted) {
				// redirect to setup page if not completed
				throw redirect(302, ROUTES.SETUP);
			}
		} catch (error) {
			// if it is a redirect, re-throw it
			if (isRedirect(error)) {
				throw error;
			}
			// log other errors but continue (fail-open to avoid blocking access)
			logger.error(`Failed to check setup status: ${JSON.stringify(error)}`);
		}

		return resolve(event);
	},
	// session middleware
	async ({ event, resolve }) => {
		const session = await auth.api.getSession({ headers: event.request.headers });

		if (session && 'user' in session) {
			event.locals.user = session.user as DBUser;
			event.locals.isAdmin = session.user.role === RoleNames.admin;
		} else {
			event.locals.user = null;
			event.locals.isAdmin = false;
		}

		return resolve(event);
	},
	// better-auth handler
	async ({ event, resolve }) => {
		return svelteKitHandler({ event, resolve, auth, building });
	}
);

export const handleValidationError: HandleValidationError = ({ event, issues }) => {
	if (
		(event.route.id === '/(main)/[slug]' ||
			event.route.id === '/(main)/[slug]/edit' ||
			event.route.id === '/(main)/[slug]/raw') &&
		issues.some((issue) => issue.path?.includes('slug'))
	) {
		throw redirect(302, '/error?message=Invalid paste identifier');
	}

	return {
		message: 'Bad Request',
	};
};
