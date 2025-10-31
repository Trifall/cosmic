<script lang="ts">
	import {
		type CronConfig,
		type CronFrequency,
		generateCron,
		getDayIntervalWarning,
		getDayWarning,
		parseCronValue,
	} from './cron.js';

	type CronJobInputProps = {
		value?: string;
		name?: string;
		class?: string;
		id?: string;
		disabled?: boolean;
	};

	let {
		value = $bindable('0 5 * * 1'),
		name = 'autoZipBackupsCron',
		class: className = '',
		disabled = $bindable(false),
	}: CronJobInputProps = $props();

	// frequency options
	const frequencies = [
		{ value: 'minute', label: 'minutes' },
		{ value: 'hour', label: 'hours' },
		{ value: 'day', label: 'days' },
		{ value: 'week', label: 'week' },
		{ value: 'month', label: 'months' },
	];

	// days of week
	const daysOfWeek = [
		{ value: '0', label: 'SUN', fullName: 'Sunday' },
		{ value: '1', label: 'MON', fullName: 'Monday' },
		{ value: '2', label: 'TUE', fullName: 'Tuesday' },
		{ value: '3', label: 'WED', fullName: 'Wednesday' },
		{ value: '4', label: 'THU', fullName: 'Thursday' },
		{ value: '5', label: 'FRI', fullName: 'Friday' },
		{ value: '6', label: 'SAT', fullName: 'Saturday' },
	];

	// hours (0-23)
	const hours = Array.from({ length: 24 }, (_, i) => ({
		value: i.toString(),
		label: i.toString().padStart(2, '0'),
	}));

	// minutes (0-59)
	const minutes = Array.from({ length: 60 }, (_, i) => ({
		value: i.toString(),
		label: i.toString().padStart(2, '0'),
	}));

	// days of month (1-31) plus Last day option
	const daysOfMonth = [
		...Array.from({ length: 31 }, (_, i) => ({
			value: (i + 1).toString(),
			label: (i + 1).toString(),
		})),
		{ value: 'L', label: 'Last day' },
	];

	let frequency = $state<CronFrequency>('week');
	let selectedDays = $state<string[]>(['1']); // monday by default
	let selectedHour = $state<string>('5');
	let selectedMinute = $state<string>('0');
	let selectedDayOfMonth = $state<string>('1');
	let interval = $state<number>(1);
	let isInitialized = $state<boolean>(false);

	// parse initial value when it changes from outside
	$effect(() => {
		if (value && !isInitialized) {
			const parsed = parseCronValue(value);
			frequency = parsed.frequency;
			selectedDays = parsed.selectedDays;
			selectedHour = parsed.selectedHour;
			selectedMinute = parsed.selectedMinute;
			selectedDayOfMonth = parsed.selectedDayOfMonth;
			interval = parsed.interval;
			isInitialized = true;
		}
	});

	// generate new cron when internal settings change
	$effect(() => {
		// only generate new cron if initialized and internal state changes
		if (isInitialized) {
			// track the internal state to trigger cron generation
			// this is a requirement for svelte to detect changes
			void frequency;
			void selectedDays;
			void selectedHour;
			void selectedMinute;
			void selectedDayOfMonth;
			void interval;

			const config: CronConfig = {
				frequency,
				selectedDays,
				selectedHour,
				selectedMinute,
				selectedDayOfMonth,
				interval,
			};
			const newValue = generateCron(config);
			if (newValue !== value) {
				value = newValue;
			}
		}
	});

	const toggleDay = (day: string) => {
		if (selectedDays.includes(day)) {
			selectedDays = selectedDays.filter((d) => d !== day);
		} else {
			selectedDays = [...selectedDays, day];
		}
	};
</script>

<div class="w-full space-y-3 {className}" class:opacity-50={disabled}>
	<div
		class="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background p-3 sm:gap-3"
	>
		<span class="text-sm font-medium">Every</span>

		{#if ['minute', 'hour', 'day', 'month'].includes(frequency)}
			<input
				type="number"
				bind:value={interval}
				min="1"
				max={frequency === 'minute'
					? 59
					: frequency === 'hour'
						? 23
						: frequency === 'day'
							? 31
							: 12}
				class="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
				{disabled}
			/>
		{/if}

		<select
			bind:value={frequency}
			class="min-w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
			{disabled}
		>
			{#each frequencies as freq (freq.value)}
				<option value={freq.value}>{freq.label}</option>
			{/each}
		</select>

		{#if frequency === 'week'}
			<span class="text-sm font-medium text-foreground">on</span>
			<div class="flex flex-wrap gap-1">
				{#each daysOfWeek as day (day.value)}
					<button
						type="button"
						class="min-w-8 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
						class:bg-primary={selectedDays.includes(day.value)}
						class:text-primary-foreground={selectedDays.includes(day.value)}
						class:hover:bg-red-500={selectedDays.includes(day.value) && !disabled}
						class:bg-background={!selectedDays.includes(day.value)}
						class:text-foreground={!selectedDays.includes(day.value)}
						class:hover:bg-accent={!selectedDays.includes(day.value) && !disabled}
						class:hover:text-accent-foreground={!selectedDays.includes(day.value) && !disabled}
						onclick={() => !disabled && toggleDay(day.value)}
						title={day.fullName}
						{disabled}
					>
						{day.label}
					</button>
				{/each}
			</div>
		{/if}

		{#if frequency === 'month'}
			<span class="text-sm font-medium text-foreground">on day</span>
			<select
				bind:value={selectedDayOfMonth}
				class="min-w-16 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
				{disabled}
			>
				{#each daysOfMonth as day (day.value)}
					<option value={day.value}>{day.label}</option>
				{/each}
			</select>
		{/if}

		{#if ['day', 'week', 'month'].includes(frequency)}
			<span class="text-sm font-medium text-foreground">at</span>
			<div class="flex flex-shrink-0 items-center gap-1">
				<select
					bind:value={selectedHour}
					class="w-14 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring sm:w-16"
					{disabled}
				>
					{#each hours as hour (hour.value)}
						<option value={hour.value}>{hour.label}</option>
					{/each}
				</select>
				<span class="text-sm font-bold text-foreground">:</span>
				<select
					bind:value={selectedMinute}
					class="w-14 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring sm:w-16"
					{disabled}
				>
					{#each minutes as minute (minute.value)}
						<option value={minute.value}>{minute.label}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if frequency === 'hour'}
			<span class="text-sm font-medium text-foreground">at minute</span>
			<select
				bind:value={selectedMinute}
				class="min-w-16 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
				{disabled}
			>
				{#each minutes as minute (minute.value)}
					<option value={minute.value}>{minute.label}</option>
				{/each}
			</select>
		{/if}

		<button
			type="button"
			class="ml-auto rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-red-500 hover:text-foreground"
			class:hover:bg-red-500={!disabled}
			onclick={() => {
				if (!disabled) {
					frequency = 'week';
					selectedDays = ['1'];
					selectedHour = '5';
					selectedMinute = '0';
					interval = 1;
				}
			}}
			{disabled}
		>
			Reset
		</button>
	</div>

	<!-- cron preview -->
	<div class="flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
		<span class="flex-shrink-0 font-medium">Cron Expression:</span>
		<code class="break-all rounded border bg-muted/50 px-2 py-1 font-mono text-xs text-primary">
			{value}
		</code>
	</div>

	<!-- warnings -->
	{#if (frequency === 'month' && getDayWarning(selectedDayOfMonth)) || getDayIntervalWarning(frequency, interval)}
		<div
			class="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
		>
			<svg class="mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
					clip-rule="evenodd"
				/>
			</svg>
			<div class="space-y-2">
				{#if frequency === 'month' && getDayWarning(selectedDayOfMonth)}
					<div>
						<div class="font-medium">Date availability warning</div>
						<div class="mt-1">{getDayWarning(selectedDayOfMonth)}</div>
					</div>
				{/if}
				{#if getDayIntervalWarning(frequency, interval)}
					<div>
						<div class="font-medium">Day interval limitation</div>
						<div class="mt-1">{getDayIntervalWarning(frequency, interval)}</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- hidden input for form submission -->
	<input type="hidden" {name} {value} />
</div>
