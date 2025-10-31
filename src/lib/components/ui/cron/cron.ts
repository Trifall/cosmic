// Types for cron configuration
export type CronFrequency = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface CronConfig {
	frequency: CronFrequency;
	selectedDays: string[];
	selectedHour: string;
	selectedMinute: string;
	selectedDayOfMonth: string;
	interval: number;
}

export interface ParsedCronResult {
	frequency: CronFrequency;
	selectedDays: string[];
	selectedHour: string;
	selectedMinute: string;
	selectedDayOfMonth: string;
	interval: number;
}

export const getDayWarning = (day: string): string | null => {
	const dayNum = parseInt(day);
	if (isNaN(dayNum)) return null;

	if (dayNum === 29) return 'February only has 29 days in leap years';
	if (dayNum === 30) return 'February only has 28-29 days';
	if (dayNum === 31) return 'April, June, September, and November only have 30 days';

	return null;
};

const getOrdinal = (num: number): string => {
	const remainder10 = num % 10;
	const remainder100 = num % 100;

	if (remainder100 >= 11 && remainder100 <= 13) {
		return `${num}th`;
	}

	switch (remainder10) {
		case 1:
			return `${num}st`;
		case 2:
			return `${num}nd`;
		case 3:
			return `${num}rd`;
		default:
			return `${num}th`;
	}
};

export const getDayIntervalWarning = (
	frequency: CronFrequency,
	interval: number
): string | null => {
	if (frequency === 'day' && interval > 1) {
		// precalculate first 3 examples
		const examples = [getOrdinal(1), getOrdinal(1 + interval), getOrdinal(1 + interval * 2)].filter(
			(day) => parseInt(day) <= 31
		); // only include valid days

		const exampleText = examples.join(', ');
		return `Every ${interval} days runs on calendar days (${exampleText}${examples.length > 2 && interval < 11 ? ', etc.' : ''}) of each month, not every ${interval} elapsed days. May skip days across month boundaries.`;
	}
	return null;
};

// parse existing cron value into configuration
export const parseCronValue = (cronValue: string): ParsedCronResult => {
	const defaultResult: ParsedCronResult = {
		frequency: 'week',
		selectedDays: ['1'],
		selectedHour: '5',
		selectedMinute: '0',
		selectedDayOfMonth: '1',
		interval: 1,
	};

	const parts = cronValue.split(' ');
	if (parts.length !== 5) return defaultResult;

	const [min, hour, dayOfMonth, month, dayOfWeek] = parts;

	const result = { ...defaultResult };
	result.selectedMinute = min === '*' ? '0' : min.includes('/') ? '0' : min;
	result.selectedHour = hour === '*' ? '0' : hour.includes('/') ? '0' : hour;

	// parse intervals from step values
	if (min.includes('/')) {
		result.frequency = 'minute';
		result.interval = parseInt(min.split('/')[1]) || 1;
	} else if (hour.includes('/')) {
		result.frequency = 'hour';
		result.interval = parseInt(hour.split('/')[1]) || 1;
	} else if (dayOfMonth.includes('/')) {
		result.frequency = 'day';
		result.interval = parseInt(dayOfMonth.split('/')[1]) || 1;
	} else if (month.includes('/')) {
		result.frequency = 'month';
		result.interval = parseInt(month.split('/')[1]) || 1;
		result.selectedDayOfMonth = dayOfMonth === '*' ? '1' : dayOfMonth;
	} else if (dayOfWeek !== '*') {
		result.frequency = 'week';
		result.selectedDays = dayOfWeek.includes(',') ? dayOfWeek.split(',') : [dayOfWeek];
	} else if (dayOfMonth !== '*') {
		result.frequency = 'month';
		result.selectedDayOfMonth = dayOfMonth;
	} else if (hour !== '*') {
		result.frequency = 'day';
	} else if (min !== '*') {
		result.frequency = 'hour';
	} else {
		result.frequency = 'minute';
	}

	return result;
};

export const generateCron = (config: CronConfig): string => {
	const cronParts: string[] = ['*', '*', '*', '*', '*']; // [minute, hour, day, month, dayOfWeek]

	switch (config.frequency) {
		case 'minute':
			if (config.interval > 1) {
				cronParts[0] = `*/${config.interval}`;
			} else {
				cronParts[0] = '*';
			}
			break;

		case 'hour':
			cronParts[0] = config.selectedMinute;
			if (config.interval > 1) {
				cronParts[1] = `*/${config.interval}`;
			} else {
				cronParts[1] = '*';
			}
			break;

		case 'day':
			cronParts[0] = config.selectedMinute;
			cronParts[1] = config.selectedHour;
			if (config.interval > 1) {
				cronParts[2] = `*/${config.interval}`;
			}
			break;

		case 'week':
			cronParts[0] = config.selectedMinute;
			cronParts[1] = config.selectedHour;
			cronParts[4] =
				config.selectedDays.length === 1 ? config.selectedDays[0] : config.selectedDays.join(',');
			break;

		case 'month':
			cronParts[0] = config.selectedMinute;
			cronParts[1] = config.selectedHour;
			cronParts[2] = config.selectedDayOfMonth;
			if (config.interval > 1) {
				cronParts[3] = `*/${config.interval}`;
			}
			break;
	}

	return cronParts.join(' ');
};
