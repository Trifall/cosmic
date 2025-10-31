<script lang="ts">
	import { formatFormalDate } from '@/src/lib/utils/format';
	import { format } from 'date-fns/format';

	let { currentExpiresAt }: { currentExpiresAt?: Date | string | null } = $props();

	// format the current expiration date for display
	const formattedExpiresAt = $derived(() => {
		if (!currentExpiresAt) return null;
		const date =
			typeof currentExpiresAt === 'string' ? new Date(currentExpiresAt) : currentExpiresAt;

		// get time with timezone
		const time = format(date, 'h:mm a');
		const timezone = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
		const formalDate = formatFormalDate(date);

		return `${time} ${timezone}, ${formalDate}`;
	});
</script>

<!-- current expiration warning -->
{#if formattedExpiresAt()}
	<div
		class="mb-2 flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
	>
		<svg class="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
			<path
				fill-rule="evenodd"
				d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
				clip-rule="evenodd"
			/>
		</svg>
		<div>This paste expires at {formattedExpiresAt()}</div>
	</div>
{/if}
