<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="w-full">
	<div class="w-full overflow-x-hidden">
		{@render children()}
	</div>
</div>
