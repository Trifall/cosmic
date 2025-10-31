import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServerUptime } from '../system';

describe('System Utils', () => {
	describe('getServerUptime', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('should return formatted uptime with milliseconds', () => {
			// mock process.uptime to return 3665 seconds (1h 1m 5s)
			vi.spyOn(process, 'uptime').mockReturnValue(3665);

			const result = getServerUptime();

			expect(result.formatted).toBe('1h 1m 5s');
			expect(result.milliseconds).toBe(3665000);
		});

		it('should format uptime with days', () => {
			// 2 days, 3 hours, 4 minutes, 5 seconds = 183845 seconds
			vi.spyOn(process, 'uptime').mockReturnValue(183845);

			const result = getServerUptime();

			expect(result.formatted).toBe('2d 3h 4m 5s');
			expect(result.milliseconds).toBe(183845000);
		});

		it('should format uptime with only seconds', () => {
			// 45 seconds
			vi.spyOn(process, 'uptime').mockReturnValue(45);

			const result = getServerUptime();

			expect(result.formatted).toBe('45s');
			expect(result.milliseconds).toBe(45000);
		});

		it('should format uptime with minutes and seconds', () => {
			// 5 minutes 30 seconds = 330 seconds
			vi.spyOn(process, 'uptime').mockReturnValue(330);

			const result = getServerUptime();

			expect(result.formatted).toBe('5m 30s');
			expect(result.milliseconds).toBe(330000);
		});

		it('should format uptime with hours, minutes, and seconds', () => {
			// 2 hours, 15 minutes, 42 seconds = 8142 seconds
			vi.spyOn(process, 'uptime').mockReturnValue(8142);

			const result = getServerUptime();

			expect(result.formatted).toBe('2h 15m 42s');
			expect(result.milliseconds).toBe(8142000);
		});

		it('should handle zero uptime', () => {
			vi.spyOn(process, 'uptime').mockReturnValue(0);

			const result = getServerUptime();

			expect(result.formatted).toBe('0s');
			expect(result.milliseconds).toBe(0);
		});

		it('should handle exactly 1 day', () => {
			// 86400 seconds = 1 day
			vi.spyOn(process, 'uptime').mockReturnValue(86400);

			const result = getServerUptime();

			expect(result.formatted).toBe('1d 0h 0m 0s');
			expect(result.milliseconds).toBe(86400000);
		});

		it('should handle exactly 1 hour', () => {
			// 3600 seconds = 1 hour
			vi.spyOn(process, 'uptime').mockReturnValue(3600);

			const result = getServerUptime();

			expect(result.formatted).toBe('1h 0m 0s');
			expect(result.milliseconds).toBe(3600000);
		});

		it('should handle exactly 1 minute', () => {
			// 60 seconds = 1 minute
			vi.spyOn(process, 'uptime').mockReturnValue(60);

			const result = getServerUptime();

			expect(result.formatted).toBe('1m 0s');
			expect(result.milliseconds).toBe(60000);
		});

		it('should floor fractional seconds', () => {
			// 123.789 seconds should be floored to 123 seconds
			vi.spyOn(process, 'uptime').mockReturnValue(123.789);

			const result = getServerUptime();

			expect(result.formatted).toBe('2m 3s');
			expect(result.milliseconds).toBe(123789);
		});

		it('should handle very long uptimes', () => {
			// 365 days = 31536000 seconds
			vi.spyOn(process, 'uptime').mockReturnValue(31536000);

			const result = getServerUptime();

			expect(result.formatted).toBe('365d 0h 0m 0s');
			expect(result.milliseconds).toBe(31536000000);
		});

		it('should not include hours if days is 0 and hours is 0', () => {
			// 120 seconds = 2 minutes
			vi.spyOn(process, 'uptime').mockReturnValue(120);

			const result = getServerUptime();

			expect(result.formatted).toBe('2m 0s');
			expect(result.formatted).not.toContain('h');
		});

		it('should always include seconds', () => {
			// test various uptimes to ensure seconds is always present
			const testCases = [0, 60, 3600, 86400];

			testCases.forEach((uptime) => {
				vi.spyOn(process, 'uptime').mockReturnValue(uptime);
				const result = getServerUptime();
				expect(result.formatted).toMatch(/\d+s$/);
			});
		});

		it('should maintain proper spacing between units', () => {
			vi.spyOn(process, 'uptime').mockReturnValue(90061); // 1d 1h 1m 1s

			const result = getServerUptime();

			// check that there's exactly one space between each unit
			expect(result.formatted.split(' ')).toHaveLength(4);
			expect(result.formatted).toBe('1d 1h 1m 1s');
		});

		it('should calculate milliseconds correctly', () => {
			const testCases = [
				{ seconds: 1, expectedMs: 1000 },
				{ seconds: 60, expectedMs: 60000 },
				{ seconds: 3600, expectedMs: 3600000 },
				{ seconds: 86400, expectedMs: 86400000 },
				{ seconds: 123.456, expectedMs: 123456 },
			];

			testCases.forEach(({ seconds, expectedMs }) => {
				vi.spyOn(process, 'uptime').mockReturnValue(seconds);
				const result = getServerUptime();
				expect(result.milliseconds).toBe(expectedMs);
			});
		});

		it('should handle negative uptime gracefully', () => {
			// this shouldn't happen in practice, but let's test edge case
			vi.spyOn(process, 'uptime').mockReturnValue(-100);

			const result = getServerUptime();

			// negative values will result in negative days/hours/etc
			expect(result.milliseconds).toBe(-100000);
			expect(result.formatted).toContain('-');
		});

		it('should return object with correct structure', () => {
			vi.spyOn(process, 'uptime').mockReturnValue(100);

			const result = getServerUptime();

			expect(result).toHaveProperty('formatted');
			expect(result).toHaveProperty('milliseconds');
			expect(typeof result.formatted).toBe('string');
			expect(typeof result.milliseconds).toBe('number');
		});

		it('should handle boundary case: 59 seconds', () => {
			vi.spyOn(process, 'uptime').mockReturnValue(59);

			const result = getServerUptime();

			expect(result.formatted).toBe('59s');
			expect(result.formatted).not.toContain('m');
		});

		it('should handle boundary case: 3599 seconds (59m 59s)', () => {
			vi.spyOn(process, 'uptime').mockReturnValue(3599);

			const result = getServerUptime();

			expect(result.formatted).toBe('59m 59s');
			expect(result.formatted).not.toContain('h');
		});

		it('should handle boundary case: 86399 seconds (23h 59m 59s)', () => {
			vi.spyOn(process, 'uptime').mockReturnValue(86399);

			const result = getServerUptime();

			expect(result.formatted).toBe('23h 59m 59s');
			expect(result.formatted).not.toContain('d');
		});
	});
});
