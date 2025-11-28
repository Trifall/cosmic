import { createHash } from 'crypto';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { createChildLogger } from '$lib/server/logger';
import { getSetting } from '$lib/server/settings';
import { RoleNames } from '$src/lib/auth/roles-shared';

const logger = createChildLogger('RateLimit');

/**
 * Rate limiting service for paste operations
 * Uses in-memory rate limiting with sliding window approach
 */
class RateLimitService {
	private authedLimiter: RateLimiterMemory | null = null;
	private unauthLimiter: RateLimiterMemory | null = null;
	private unauthGlobalLimiter: RateLimiterMemory | null = null;
	private initialized = false;
	private initializationPromise: Promise<void> | null = null;

	private async waitForInitializationToFinish() {
		if (!this.initializationPromise) {
			return;
		}

		try {
			await this.initializationPromise;
		} catch (error) {
			logger.warn('Previous rate limiter initialization failed', error);
		}
	}

	/**
	 * Initialize the rate limiter with current settings (internal implementation)
	 */
	private async doInitialize() {
		try {
			// authenticated user rate limiting
			const authedEnabled = await getSetting('rateLimitingAuthedEnabled');
			const authedLimit = await getSetting('rateLimitingAuthedLimit');

			if (authedEnabled) {
				// create rate limiter with 1 minute sliding window
				this.authedLimiter = new RateLimiterMemory({
					points: authedLimit, // number of requests
					duration: 60, // per 60 seconds (1 minute)
					blockDuration: 0, // do not block, just reject
				});
				logger.info(
					`Rate limiting initialized: ${authedLimit} requests per minute for authenticated users`
				);
			} else {
				this.authedLimiter = null;
				logger.info('Rate limiting disabled for authenticated users');
			}

			// check if unauthenticated paste creation is enabled
			const unauthPasteCreationEnabled = await getSetting('enableUnauthenticatedPasteCreation');

			// only initialize unauthenticated rate limiting if paste creation is enabled
			if (unauthPasteCreationEnabled) {
				logger.info(
					'Unauthenticated paste creation enabled, initializing unauthenticated rate limiting...'
				);
				// unauthenticated user rate limiting (per-user by fingerprint)
				const unauthEnabled = await getSetting('rateLimitingUnauthenticatedEnabled');
				const unauthLimit = await getSetting('rateLimitingUnauthenticatedLimit');

				if (unauthEnabled) {
					this.unauthLimiter = new RateLimiterMemory({
						points: unauthLimit,
						duration: 60,
						blockDuration: 0,
					});
					logger.info(
						`Rate limiting initialized: ${unauthLimit} requests per minute per unauthenticated user`
					);
				} else {
					this.unauthLimiter = null;
					logger.info('Rate limiting disabled for individual unauthenticated users');
				}

				// unauthenticated global rate limiting (system-wide)
				const unauthGlobalEnabled = await getSetting('rateLimitingUnauthenticatedGlobalEnabled');
				const unauthGlobalLimit = await getSetting('rateLimitingUnauthenticatedGlobalLimit');

				if (unauthGlobalEnabled) {
					this.unauthGlobalLimiter = new RateLimiterMemory({
						points: unauthGlobalLimit,
						duration: 60,
						blockDuration: 0,
					});
					logger.info(
						`Rate limiting initialized: ${unauthGlobalLimit} requests per minute globally for all unauthenticated users`
					);
				} else {
					this.unauthGlobalLimiter = null;
					logger.info('Global rate limiting disabled for unauthenticated users');
				}
			} else {
				// unauthenticated paste creation is disabled, disable all unauthenticated rate limiting
				this.unauthLimiter = null;
				this.unauthGlobalLimiter = null;
				logger.info(
					'Unauthenticated paste creation disabled - all unauthenticated rate limiting disabled'
				);
			}
		} catch (error) {
			logger.error(`Failed to initialize rate limiter: ${error}`);
			// fallback to disabled state
			this.authedLimiter = null;
			this.unauthLimiter = null;
			this.unauthGlobalLimiter = null;
		}
	}

	/**
	 * Initialize the rate limiter with current settings
	 * This should be called at server startup and when settings are updated
	 */
	async initialize() {
		if (this.initialized) {
			return;
		}

		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		this.initializationPromise = (async () => {
			await this.doInitialize();
			this.initialized = true;
		})()
			.catch((error) => {
				// rethrow to allow awaiting callers to handle initialization issues
				throw error;
			})
			.finally(() => {
				this.initializationPromise = null;
			});

		return this.initializationPromise;
	}

	/**
	 * Check if a user has exceeded the rate limit for paste operations
	 * @param userId - The user ID to check
	 * @param userRole - The user's role (admin is exempt from rate limiting)
	 * @returns Object with allowed status and retry information
	 */
	async checkLimit(
		userId: string,
		userRole?: string
	): Promise<{
		allowed: boolean;
		msBeforeNext?: number;
		remainingPoints?: number;
		resetAt?: Date;
	}> {
		if (!this.initialized) {
			await this.initialize();
		}

		// admin users are exempt from rate limiting
		if (userRole === RoleNames.admin) {
			return { allowed: true };
		}

		// if rate limiting is disabled, allow all requests
		if (!this.authedLimiter) {
			return { allowed: true };
		}

		try {
			// consume 1 point for this user
			const rateLimiterRes = await this.authedLimiter.consume(userId, 1);

			return {
				allowed: true,
				remainingPoints: rateLimiterRes.remainingPoints,
				msBeforeNext: rateLimiterRes.msBeforeNext,
				resetAt: new Date(Date.now() + rateLimiterRes.msBeforeNext),
			};
		} catch (rateLimiterRes) {
			// rate limit exceeded
			logger.warn(`Rate limit exceeded for user ${userId}`);

			// type guard for rate limiter response
			const msBeforeNext =
				rateLimiterRes && typeof rateLimiterRes === 'object' && 'msBeforeNext' in rateLimiterRes
					? (rateLimiterRes.msBeforeNext as number)
					: 60000;

			return {
				allowed: false,
				msBeforeNext,
				remainingPoints: 0,
				resetAt: new Date(Date.now() + msBeforeNext),
			};
		}
	}

	/**
	 * Manually consume points for a user (useful for testing or manual operations)
	 * @param userId - The user ID
	 * @param points - Number of points to consume (default: 1)
	 */
	async consume(userId: string, points: number = 1): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (!this.authedLimiter) {
			return; // rate limiting disabled
		}

		try {
			await this.authedLimiter.consume(userId, points);
		} catch {
			// already handled in checkLimit, ignore here
		}
	}

	/**
	 * Reset the rate limit for a specific user
	 * @param userId - The user ID to reset
	 */
	async reset(userId: string): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (!this.authedLimiter) {
			return;
		}

		try {
			await this.authedLimiter.delete(userId);
			logger.info(`Rate limit reset for user ${userId}`);
		} catch (error) {
			logger.error(`Failed to reset rate limit for user ${userId}:`, error);
		}
	}

	/**
	 * Get current rate limit status for a user without consuming points
	 * @param userId - The user ID to check
	 * @returns Current rate limit status
	 */
	async getStatus(
		userId: string
	): Promise<{ remainingPoints: number; msBeforeNext: number; resetAt: Date } | null> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (!this.authedLimiter) {
			return null; // rate limiting disabled
		}

		try {
			const res = await this.authedLimiter.get(userId);
			if (!res) {
				// no consumption yet, return max points
				const limit = await getSetting('rateLimitingAuthedLimit');
				return {
					remainingPoints: limit,
					msBeforeNext: 0,
					resetAt: new Date(),
				};
			}

			return {
				remainingPoints: res.remainingPoints,
				msBeforeNext: res.msBeforeNext,
				resetAt: new Date(Date.now() + res.msBeforeNext),
			};
		} catch (error) {
			logger.error(`Failed to get rate limit status for user ${userId}:`, error);
			return null;
		}
	}

	/**
	 * Generate a browser fingerprint from IP and User-Agent
	 * @param ip - Client IP address
	 * @param userAgent - Client User-Agent string
	 * @returns SHA256 hash as fingerprint
	 */
	private generateFingerprint(ip: string, userAgent: string): string {
		const data = `${ip}:${userAgent}`;
		return createHash('sha256').update(data).digest('hex');
	}

	/**
	 * Check rate limit for unauthenticated users
	 * @param ip - Client IP address
	 * @param userAgent - Client User-Agent string
	 * @returns Object with allowed status and retry information
	 */
	async checkUnauthenticatedLimit(
		ip: string,
		userAgent: string
	): Promise<{
		allowed: boolean;
		msBeforeNext?: number;
		remainingPoints?: number;
		resetAt?: Date;
		limitType?: 'personal' | 'global';
	}> {
		if (!this.initialized) {
			await this.initialize();
		}

		// if both rate limiters are disabled, allow all requests
		if (!this.unauthLimiter && !this.unauthGlobalLimiter) {
			return { allowed: true };
		}

		const fingerprint = this.generateFingerprint(ip, userAgent);

		// check personal limit first (if enabled)
		if (this.unauthLimiter) {
			try {
				const rateLimiterRes = await this.unauthLimiter.consume(fingerprint, 1);

				// personal limit passed, now check global limit
				if (this.unauthGlobalLimiter) {
					try {
						const globalRes = await this.unauthGlobalLimiter.consume('global', 1);

						return {
							allowed: true,
							remainingPoints: Math.min(rateLimiterRes.remainingPoints, globalRes.remainingPoints),
							msBeforeNext: Math.max(rateLimiterRes.msBeforeNext, globalRes.msBeforeNext),
							resetAt: new Date(
								Date.now() + Math.max(rateLimiterRes.msBeforeNext, globalRes.msBeforeNext)
							),
						};
					} catch (globalRateLimiterRes) {
						// global limit exceeded, need to refund personal limit
						try {
							await this.unauthLimiter.reward(fingerprint, 1);
						} catch {
							// ignore refund errors
						}

						logger.warn(`Global rate limit exceeded for unauthenticated users`);

						const msBeforeNext =
							globalRateLimiterRes &&
							typeof globalRateLimiterRes === 'object' &&
							'msBeforeNext' in globalRateLimiterRes
								? (globalRateLimiterRes.msBeforeNext as number)
								: 60000;

						return {
							allowed: false,
							msBeforeNext,
							remainingPoints: 0,
							resetAt: new Date(Date.now() + msBeforeNext),
							limitType: 'global',
						};
					}
				}

				// only personal limit enabled, and it passed
				return {
					allowed: true,
					remainingPoints: rateLimiterRes.remainingPoints,
					msBeforeNext: rateLimiterRes.msBeforeNext,
					resetAt: new Date(Date.now() + rateLimiterRes.msBeforeNext),
				};
			} catch (rateLimiterRes) {
				// personal limit exceeded
				logger.warn(
					`Personal rate limit exceeded for fingerprint: ${fingerprint.substring(0, 8)}...`
				);

				const msBeforeNext =
					rateLimiterRes && typeof rateLimiterRes === 'object' && 'msBeforeNext' in rateLimiterRes
						? (rateLimiterRes.msBeforeNext as number)
						: 60000;

				return {
					allowed: false,
					msBeforeNext,
					remainingPoints: 0,
					resetAt: new Date(Date.now() + msBeforeNext),
					limitType: 'personal',
				};
			}
		}

		// only global limit enabled
		if (this.unauthGlobalLimiter) {
			try {
				const globalRes = await this.unauthGlobalLimiter.consume('global', 1);

				return {
					allowed: true,
					remainingPoints: globalRes.remainingPoints,
					msBeforeNext: globalRes.msBeforeNext,
					resetAt: new Date(Date.now() + globalRes.msBeforeNext),
				};
			} catch (globalRateLimiterRes) {
				logger.warn(`Global rate limit exceeded for unauthenticated users`);

				const msBeforeNext =
					globalRateLimiterRes &&
					typeof globalRateLimiterRes === 'object' &&
					'msBeforeNext' in globalRateLimiterRes
						? (globalRateLimiterRes.msBeforeNext as number)
						: 60000;

				return {
					allowed: false,
					msBeforeNext,
					remainingPoints: 0,
					resetAt: new Date(Date.now() + msBeforeNext),
					limitType: 'global',
				};
			}
		}

		return { allowed: true };
	}

	/**
	 * Reload the rate limiter configuration from settings
	 * Call this when rate limit settings are updated
	 */
	async reload() {
		logger.info('Reloading rate limiter configuration...');
		await this.waitForInitializationToFinish();
		this.initialized = false;
		await this.initialize();
	}
}

// singleton instance
export const rateLimitService = new RateLimitService();

/**
 * Check if a user is allowed to perform a paste operation
 * @param userId - The user ID
 * @param userRole - The user's role
 * @returns Rate limit check result
 */
export const checkPasteRateLimit = (userId: string, userRole?: string) =>
	rateLimitService.checkLimit(userId, userRole);

/**
 * Reset rate limit for a user
 * @param userId - The user ID
 */
export const resetUserRateLimit = (userId: string) => rateLimitService.reset(userId);

/**
 * Get rate limit status for a user
 * @param userId - The user ID
 */
export const getRateLimitStatus = (userId: string) => rateLimitService.getStatus(userId);

/**
 * Check rate limit for unauthenticated users
 * @param ip - Client IP address
 * @param userAgent - Client User-Agent string
 */
export const checkUnauthenticatedRateLimit = (ip: string, userAgent: string) =>
	rateLimitService.checkUnauthenticatedLimit(ip, userAgent);

/**
 * Reload rate limiter configuration
 */
export const reloadRateLimiter = () => rateLimitService.reload();
