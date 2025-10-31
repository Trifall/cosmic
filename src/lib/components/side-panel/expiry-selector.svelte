<script lang="ts">
	import ExpiresAtWarning from '@/src/lib/components/side-panel/expires-at-warning.svelte';
	import { FileWarningIcon } from '@lucide/svelte';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { EXPIRY_OPTIONS, type ExpiryValue } from '$lib/shared/settings';
	import { capitalizeFirstLetter } from '$lib/utils';

	let {
		includeNoChange = true,
		currentExpiresAt,
		expiry = $bindable(),
		disabled = false,
		forceExpiry = false,
		forceExpiryValue = '',
	}: {
		expiry?: ExpiryValue;
		currentExpiresAt?: Date | string | null;
		includeNoChange?: boolean;
		disabled?: boolean;
		forceExpiry?: boolean;
		forceExpiryValue?: ExpiryValue;
	} = $props();

	if (expiry === undefined) {
		if (forceExpiry && forceExpiryValue) {
			expiry = forceExpiryValue;
		} else {
			expiry = includeNoChange ? '' : 'never';
		}
	}

	// auto-select forced expiry value when forced
	$effect(() => {
		if (forceExpiry && forceExpiryValue && expiry !== forceExpiryValue) {
			expiry = forceExpiryValue;
		}
	});
</script>

<div class="border-t border-border pt-4">
	<h3 class="mb-3 text-sm font-semibold tracking-wider text-foreground">Expiry</h3>

	<ExpiresAtWarning {currentExpiresAt} />

	{#if forceExpiry}
		<!-- Show forced expiry display -->
		<div
			class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
		>
			<div class="font-semibold">Server-enforced expiry</div>
			<div>
				Expiry is set to {EXPIRY_OPTIONS.find((opt) => opt.value === forceExpiryValue)?.label ||
					'unknown'} by the server administrator.
			</div>
		</div>
	{:else}
		<!-- Show normal expiry selector -->
		<Select type="single" bind:value={expiry} {disabled}>
			<SelectTrigger class="border-border bg-background text-sm">
				{capitalizeFirstLetter(
					EXPIRY_OPTIONS.find((opt) => opt.value === expiry)?.label || 'Select expiry'
				)}
			</SelectTrigger>
			<SelectContent>
				{#each EXPIRY_OPTIONS as option (option.value)}
					{#if includeNoChange}
						<SelectItem value={option.value} class="cursor-pointer">
							{capitalizeFirstLetter(option.label)}
						</SelectItem>
					{:else if option.value !== ''}
						<SelectItem value={option.value} class="cursor-pointer">
							{capitalizeFirstLetter(option.label)}
						</SelectItem>
					{/if}
				{/each}
			</SelectContent>
		</Select>
	{/if}

	{#if expiry && expiry !== '' && expiry !== 'never' && !forceExpiry}
		<div
			class="mt-2 flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
		>
			<FileWarningIcon class="h-4 w-4 flex-shrink-0" />
			<div>Expired pastes are permanently deleted!</div>
		</div>
	{/if}
</div>
