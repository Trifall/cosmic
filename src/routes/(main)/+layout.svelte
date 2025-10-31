<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppTopBar from '$components/top-bar/app-top-bar.svelte';
	import type { LayoutServerData } from './$types';

	const { data, children }: { data: LayoutServerData; children: Snippet } = $props();

	const isAdmin = data.isAdmin;
	const user = data.user;
</script>

<div class="min-h-screen text-foreground">
	<AppTopBar {isAdmin} {user} />

	<!-- Spacer to account for fixed header -->
	<div class="h-14"></div>

	<!-- Content area -->
	<main class="flex-1">
		<div class="">
			{@render children()}
		</div>
	</main>
</div>
