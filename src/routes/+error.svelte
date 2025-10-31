<script lang="ts">
	import { House } from '@lucide/svelte/icons';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';

	// use custom message as title if provided, otherwise use status-based defaults
	let title = page.error?.message || `Error ${page.status}`;
	let message = '';

	// set default titles and messages based on status code only if no custom message
	if (!page.error?.message) {
		if (page.status === 401) {
			title = 'Unauthorized';
			message = 'You are not authorized to view this page.';
		} else if (page.status === 403) {
			title = 'Forbidden';
			message = 'You are not allowed to view this page.';
		} else if (page.status === 404) {
			title = 'Page Not Found';
			message = 'Sorry, the page you are looking for does not exist.';
		} else if (page.status === 503) {
			title = 'Site under maintenance';
			message = 'Something went wrong! Please try again later.';
		} else {
			title = `Error ${page.status}`;
			message = 'An unexpected error occurred.';
		}
	}
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={message} />
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<div
		class="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center text-card-foreground shadow-lg"
	>
		<h1 class="mb-4 text-4xl font-bold">{title}</h1>
		{#if message}
			<p class="mb-8 text-muted-foreground">{message}</p>
		{/if}
		<Button href="/" class={message ? '' : 'mt-4'}>
			<House />
			<span>Back to Home</span>
		</Button>
	</div>
</div>
