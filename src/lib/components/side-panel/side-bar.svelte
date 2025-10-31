<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		collapsed?: boolean;
	};

	let { children, collapsed = $bindable(false) }: Props = $props();

	const toggleSidebar = () => {
		collapsed = !collapsed;
	};
</script>

<div
	class="relative rounded-l-md bg-secondary-darker transition-all duration-300 ease-in-out {collapsed
		? 'w-4'
		: 'w-80'}"
	style="overflow-x: hidden; overflow-y: {collapsed ? 'hidden' : 'visible'};"
>
	<!-- Collapse/Expand Button -->
	<button
		type="button"
		onclick={toggleSidebar}
		class="absolute left-0 top-1/2 z-10 flex h-32 w-4 -translate-y-1/2 items-center justify-center bg-primary transition-colors hover:bg-primary/80"
		class:rounded-r-md={!collapsed}
		class:rounded-l-md={collapsed}
		title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
	>
		{#if collapsed}
			<ChevronLeft size={16} />
		{:else}
			<ChevronRight size={16} />
		{/if}
	</button>

	<div
		class="space-y-6 overflow-y-auto p-6 {collapsed
			? 'opacity-0'
			: 'opacity-100'} transition-opacity duration-300"
	>
		{@render children()}
	</div>
</div>
