<script lang="ts">
	import { getLanguageDisplayName } from '@/src/lib/shared/languages';
	import { Code } from '@lucide/svelte';

	type Props = {
		languageDistribution: Array<{
			language: string;
			count: number;
		}>;
		totalCount: number;
	};

	let { languageDistribution, totalCount }: Props = $props();
</script>

<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
	<div class="mb-4 flex items-center gap-3">
		<div class="rounded-full bg-emerald-100 p-2 dark:bg-emerald-500/20">
			<Code class="h-5 w-5 text-emerald-500" />
		</div>
		<h3 class="text-lg font-semibold">Language Usage</h3>
	</div>
	{#if languageDistribution.length > 0}
		<div class="h-44 overflow-y-auto rounded border border-border bg-background p-2">
			<div class="space-y-2">
				{#each languageDistribution as lang (lang.language)}
					<div class="grid grid-cols-[1fr_auto_auto] items-center p-1">
						<span class="text-sm font-medium">
							{getLanguageDisplayName(lang.language)}
							{#if getLanguageDisplayName(lang.language) !== lang.language}
								<span class="text-xs text-muted-foreground">({lang.language})</span>
							{/if}
						</span>
						<div class="text-right">
							<span class="text-sm font-semibold">{lang.count}</span>
						</div>
						<div class="w-10 text-right">
							{#if totalCount > 0}
								<span class="text-xs text-muted-foreground">
									({Math.round((lang.count / totalCount) * 100)}%)
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="flex items-center justify-center py-4 text-muted-foreground">
			<p>No language data available</p>
		</div>
	{/if}
</div>
