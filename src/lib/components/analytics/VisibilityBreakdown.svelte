<script lang="ts">
	import { Globe, Lock, Shield, Users } from '@lucide/svelte';

	type Props = {
		publicCount: number;
		authenticatedCount: number;
		inviteOnlyCount: number;
		privateCount: number;
		totalCount: number;
	};

	let { publicCount, authenticatedCount, inviteOnlyCount, privateCount, totalCount }: Props =
		$props();

	// calculate percentages
	const publicPercentage = $derived(
		totalCount > 0 ? Math.round((publicCount / totalCount) * 100) : 0
	);
	const authenticatedPercentage = $derived(
		totalCount > 0 ? Math.round((authenticatedCount / totalCount) * 100) : 0
	);
	const inviteOnlyPercentage = $derived(
		totalCount > 0 ? Math.round((inviteOnlyCount / totalCount) * 100) : 0
	);
	const privatePercentage = $derived(
		totalCount > 0 ? Math.round((privateCount / totalCount) * 100) : 0
	);
</script>

<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
	<div class="mb-4 flex items-center gap-3">
		<div class="rounded-full bg-indigo-100 p-2 dark:bg-indigo-500/20">
			<Shield class="h-5 w-5 text-indigo-500" />
		</div>
		<h3 class="text-lg font-semibold">Paste Visibility</h3>
	</div>
	<div class="space-y-2">
		<div class="grid grid-cols-[1fr_auto_auto] items-center">
			<div class="flex items-center gap-2">
				<Globe class="h-4 w-4 text-green-500" />
				<span class="text-sm">Public</span>
			</div>
			<div class="text-right">
				<span class="text-lg font-semibold">{publicCount}</span>
			</div>
			<div class="w-10 text-right">
				{#if totalCount > 0}
					<span class="text-xs text-muted-foreground">({publicPercentage}%)</span>
				{/if}
			</div>
		</div>
		<div class="grid grid-cols-[1fr_auto_auto] items-center">
			<div class="flex items-center gap-2">
				<Users class="h-4 w-4 text-blue-500" />
				<span class="text-sm">Authenticated</span>
			</div>
			<div class="text-right">
				<span class="text-lg font-semibold">{authenticatedCount}</span>
			</div>
			<div class="w-10 text-right">
				{#if totalCount > 0}
					<span class="text-xs text-muted-foreground">({authenticatedPercentage}%)</span>
				{/if}
			</div>
		</div>
		<div class="grid grid-cols-[1fr_auto_auto] items-center">
			<div class="flex items-center gap-2">
				<Shield class="h-4 w-4 text-yellow-500" />
				<span class="text-sm">Invite Only</span>
			</div>
			<div class="text-right">
				<span class="text-lg font-semibold">{inviteOnlyCount}</span>
			</div>
			<div class="w-10 text-right">
				{#if totalCount > 0}
					<span class="text-xs text-muted-foreground">({inviteOnlyPercentage}%)</span>
				{/if}
			</div>
		</div>
		<div class="grid grid-cols-[1fr_auto_auto] items-center">
			<div class="flex items-center gap-2">
				<Lock class="h-4 w-4 text-red-500" />
				<span class="text-sm">Private</span>
			</div>
			<div class="text-right">
				<span class="text-lg font-semibold">{privateCount}</span>
			</div>
			<div class="w-10 text-right">
				{#if totalCount > 0}
					<span class="text-xs text-muted-foreground">({privatePercentage}%)</span>
				{/if}
			</div>
		</div>
	</div>
</div>
