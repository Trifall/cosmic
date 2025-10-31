import { describe, expect, it } from 'vitest';
import {
	type CronConfig,
	generateCron,
	getDayIntervalWarning,
	getDayWarning,
	parseCronValue,
} from './cron';

describe('Cron Utils', () => {
	describe('getDayWarning', () => {
		it('should return null for valid days (1-28)', () => {
			expect(getDayWarning('1')).toBeNull();
			expect(getDayWarning('15')).toBeNull();
			expect(getDayWarning('28')).toBeNull();
		});

		it('should return warning for day 29 (leap year issue)', () => {
			expect(getDayWarning('29')).toBe('February only has 29 days in leap years');
		});

		it('should return warning for day 30 (February issue)', () => {
			expect(getDayWarning('30')).toBe('February only has 28-29 days');
		});

		it('should return warning for day 31 (short month issue)', () => {
			expect(getDayWarning('31')).toBe('April, June, September, and November only have 30 days');
		});

		it('should return null for invalid input', () => {
			expect(getDayWarning('invalid')).toBeNull();
			expect(getDayWarning('L')).toBeNull();
			expect(getDayWarning('')).toBeNull();
		});

		it('should handle edge cases', () => {
			expect(getDayWarning('0')).toBeNull();
			expect(getDayWarning('32')).toBeNull();
		});
	});

	describe('getDayIntervalWarning', () => {
		it('should return null for non-day frequencies', () => {
			expect(getDayIntervalWarning('minute', 5)).toBeNull();
			expect(getDayIntervalWarning('hour', 3)).toBeNull();
			expect(getDayIntervalWarning('week', 2)).toBeNull();
			expect(getDayIntervalWarning('month', 4)).toBeNull();
		});

		it('should return null for day frequency with interval 1', () => {
			expect(getDayIntervalWarning('day', 1)).toBeNull();
		});

		it('should return warning for day frequency with interval > 1', () => {
			const result = getDayIntervalWarning('day', 5);
			expect(result).toContain('Every 5 days runs on calendar days');
			expect(result).toContain('not every 5 elapsed days');
			expect(result).toContain('May skip days across month boundaries');
		});

		it('should handle different intervals correctly', () => {
			const result10 = getDayIntervalWarning('day', 10);
			expect(result10).toContain('Every 10 days');
			expect(result10).toContain('(1st, 11th, 21st, etc.)');

			const result3 = getDayIntervalWarning('day', 3);
			expect(result3).toContain('Every 3 days');
			expect(result3).toContain('(1st, 4th, 7th, etc.)');
		});
	});

	describe('parseCronValue', () => {
		it('should return default result for invalid cron expressions', () => {
			const result = parseCronValue('invalid');
			expect(result).toEqual({
				frequency: 'week',
				selectedDays: ['1'],
				selectedHour: '5',
				selectedMinute: '0',
				selectedDayOfMonth: '1',
				interval: 1,
			});
		});

		it('should return default result for incomplete cron expressions', () => {
			const result = parseCronValue('0 5 *');
			expect(result).toEqual({
				frequency: 'week',
				selectedDays: ['1'],
				selectedHour: '5',
				selectedMinute: '0',
				selectedDayOfMonth: '1',
				interval: 1,
			});
		});

		it('should parse minute intervals correctly', () => {
			const result = parseCronValue('*/5 * * * *');
			expect(result.frequency).toBe('minute');
			expect(result.interval).toBe(5);
			expect(result.selectedMinute).toBe('0');
			expect(result.selectedHour).toBe('0');
		});

		it('should parse hour intervals correctly', () => {
			const result = parseCronValue('30 */3 * * *');
			expect(result.frequency).toBe('hour');
			expect(result.interval).toBe(3);
			expect(result.selectedMinute).toBe('30');
			expect(result.selectedHour).toBe('0');
		});

		it('should parse day intervals correctly', () => {
			const result = parseCronValue('15 8 */2 * *');
			expect(result.frequency).toBe('day');
			expect(result.interval).toBe(2);
			expect(result.selectedMinute).toBe('15');
			expect(result.selectedHour).toBe('8');
		});

		it('should parse month intervals correctly', () => {
			const result = parseCronValue('0 12 15 */6 *');
			expect(result.frequency).toBe('month');
			expect(result.interval).toBe(6);
			expect(result.selectedMinute).toBe('0');
			expect(result.selectedHour).toBe('12');
			expect(result.selectedDayOfMonth).toBe('15');
		});

		it('should parse week frequency correctly (single day)', () => {
			const result = parseCronValue('30 14 * * 1');
			expect(result.frequency).toBe('week');
			expect(result.selectedDays).toEqual(['1']);
			expect(result.selectedMinute).toBe('30');
			expect(result.selectedHour).toBe('14');
		});

		it('should parse week frequency correctly (multiple days)', () => {
			const result = parseCronValue('0 9 * * 1,3,5');
			expect(result.frequency).toBe('week');
			expect(result.selectedDays).toEqual(['1', '3', '5']);
			expect(result.selectedMinute).toBe('0');
			expect(result.selectedHour).toBe('9');
		});

		it('should parse monthly frequency correctly (specific day)', () => {
			const result = parseCronValue('45 16 25 * *');
			expect(result.frequency).toBe('month');
			expect(result.selectedDayOfMonth).toBe('25');
			expect(result.selectedMinute).toBe('45');
			expect(result.selectedHour).toBe('16');
		});

		it('should parse daily frequency correctly', () => {
			const result = parseCronValue('0 6 * * *');
			expect(result.frequency).toBe('day');
			expect(result.selectedMinute).toBe('0');
			expect(result.selectedHour).toBe('6');
		});

		it('should parse hourly frequency correctly', () => {
			const result = parseCronValue('15 * * * *');
			expect(result.frequency).toBe('hour');
			expect(result.selectedMinute).toBe('15');
		});

		it('should handle special "L" day value', () => {
			const result = parseCronValue('0 0 L * *');
			expect(result.frequency).toBe('month');
			expect(result.selectedDayOfMonth).toBe('L');
		});
	});

	describe('generateCron', () => {
		it('should generate minute interval cron correctly', () => {
			const config: CronConfig = {
				frequency: 'minute',
				interval: 5,
				selectedDays: [],
				selectedHour: '0',
				selectedMinute: '0',
				selectedDayOfMonth: '1',
			};
			expect(generateCron(config)).toBe('*/5 * * * *');
		});

		it('should generate every minute cron correctly', () => {
			const config: CronConfig = {
				frequency: 'minute',
				interval: 1,
				selectedDays: [],
				selectedHour: '0',
				selectedMinute: '0',
				selectedDayOfMonth: '1',
			};
			expect(generateCron(config)).toBe('* * * * *');
		});

		it('should generate hour interval cron correctly', () => {
			const config: CronConfig = {
				frequency: 'hour',
				interval: 3,
				selectedDays: [],
				selectedHour: '0',
				selectedMinute: '30',
				selectedDayOfMonth: '1',
			};
			expect(generateCron(config)).toBe('30 */3 * * *');
		});

		it('should generate every hour cron correctly', () => {
			const config: CronConfig = {
				frequency: 'hour',
				interval: 1,
				selectedDays: [],
				selectedHour: '0',
				selectedMinute: '15',
				selectedDayOfMonth: '1',
			};
			expect(generateCron(config)).toBe('15 * * * *');
		});

		it('should generate day interval cron correctly', () => {
			const config: CronConfig = {
				frequency: 'day',
				interval: 2,
				selectedDays: [],
				selectedHour: '8',
				selectedMinute: '30',
				selectedDayOfMonth: '1',
			};
			expect(generateCron(config)).toBe('30 8 */2 * *');
		});

		it('should generate daily cron correctly', () => {
			const config: CronConfig = {
				frequency: 'day',
				interval: 1,
				selectedDays: [],
				selectedHour: '6',
				selectedMinute: '0',
				selectedDayOfMonth: '1',
			};
			expect(generateCron(config)).toBe('0 6 * * *');
		});

		it('should generate weekly cron correctly (single day)', () => {
			const config: CronConfig = {
				frequency: 'week',
				interval: 1,
				selectedDays: ['1'],
				selectedHour: '9',
				selectedMinute: '0',
				selectedDayOfMonth: '1',
			};
			expect(generateCron(config)).toBe('0 9 * * 1');
		});

		it('should generate weekly cron correctly (multiple days)', () => {
			const config: CronConfig = {
				frequency: 'week',
				interval: 1,
				selectedDays: ['1', '3', '5'],
				selectedHour: '14',
				selectedMinute: '30',
				selectedDayOfMonth: '1',
			};
			expect(generateCron(config)).toBe('30 14 * * 1,3,5');
		});

		it('should generate monthly cron correctly', () => {
			const config: CronConfig = {
				frequency: 'month',
				interval: 1,
				selectedDays: [],
				selectedHour: '12',
				selectedMinute: '0',
				selectedDayOfMonth: '15',
			};
			expect(generateCron(config)).toBe('0 12 15 * *');
		});

		it('should generate monthly interval cron correctly', () => {
			const config: CronConfig = {
				frequency: 'month',
				interval: 3,
				selectedDays: [],
				selectedHour: '10',
				selectedMinute: '30',
				selectedDayOfMonth: '1',
			};
			expect(generateCron(config)).toBe('30 10 1 */3 *');
		});

		it('should handle special "L" day value', () => {
			const config: CronConfig = {
				frequency: 'month',
				interval: 1,
				selectedDays: [],
				selectedHour: '23',
				selectedMinute: '59',
				selectedDayOfMonth: 'L',
			};
			expect(generateCron(config)).toBe('59 23 L * *');
		});
	});

	describe('round-trip parsing and generation', () => {
		const testCases: Array<{ description: string; cronExpression: string }> = [
			{ description: 'every 5 minutes', cronExpression: '*/5 * * * *' },
			{ description: 'every 3 hours at minute 30', cronExpression: '30 */3 * * *' },
			{ description: 'every 2 days at 8:30', cronExpression: '30 8 */2 * *' },
			{ description: 'weekly on Monday at 9:00', cronExpression: '0 9 * * 1' },
			{ description: 'weekly on Mon, Wed, Fri at 14:30', cronExpression: '30 14 * * 1,3,5' },
			{ description: 'monthly on 15th at 12:00', cronExpression: '0 12 15 * *' },
			{ description: 'every 6 months on 1st at 10:30', cronExpression: '30 10 1 */6 *' },
			{ description: 'daily at 6:00', cronExpression: '0 6 * * *' },
			{ description: 'hourly at minute 15', cronExpression: '15 * * * *' },
			{ description: 'monthly on last day at 23:59', cronExpression: '59 23 L * *' },
		];

		testCases.forEach(({ description, cronExpression }) => {
			it(`should round-trip correctly for ${description}`, () => {
				const parsed = parseCronValue(cronExpression);
				const generated = generateCron(parsed);
				expect(generated).toBe(cronExpression);
			});
		});
	});

	describe('edge cases and error handling', () => {
		it('should handle empty cron expression', () => {
			const result = parseCronValue('');
			expect(result.frequency).toBe('week');
		});

		it('should handle malformed intervals', () => {
			const result = parseCronValue('*/invalid * * * *');
			expect(result.frequency).toBe('minute');
			expect(result.interval).toBe(1); // fallback to 1
		});

		it('should handle zero interval', () => {
			const result = parseCronValue('*/0 * * * *');
			expect(result.interval).toBe(1); // fallback to 1
		});

		it('should generate valid cron with empty selectedDays for week frequency', () => {
			const config: CronConfig = {
				frequency: 'week',
				interval: 1,
				selectedDays: [],
				selectedHour: '9',
				selectedMinute: '0',
				selectedDayOfMonth: '1',
			};
			const result = generateCron(config);
			expect(result).toBe('0 9 * * '); // empty day of week
		});
	});
});
