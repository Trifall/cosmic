<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutServerData } from '../$types';

	let { children }: { data: LayoutServerData; children: Snippet } = $props();
</script>

<div class="box-border flex w-full flex-col gap-4 overflow-x-hidden p-2 lg:p-4">
	<div class="w-full overflow-x-hidden">
		{@render children()}
	</div>
</div>
