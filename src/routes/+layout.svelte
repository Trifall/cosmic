<script lang="ts">
	import { ModeWatcher, mode } from 'mode-watcher';
	import type { Snippet } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import { page } from '$app/stores';
	import '$src/app.css';
	import { getPublicSiteName } from '$src/lib/utils/format';

	let { children }: { children: Snippet } = $props();
</script>

<ModeWatcher />

<svelte:head>
	<title>{getPublicSiteName()}</title>
	<meta name="description" content="A self-hostable pastebin and file sharing service" />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content={$page.url.href} />
	<meta property="og:title" content={getPublicSiteName()} />
	<meta property="og:description" content="A self-hostable pastebin and file sharing service" />
	<meta property="og:image" content="{$page.url.origin}/og_image.png" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content={$page.url.href} />
	<meta property="twitter:title" content={getPublicSiteName()} />
	<meta
		property="twitter:description"
		content="A self-hostable pastebin and file sharing service"
	/>
	<meta property="twitter:image" content="{$page.url.origin}/og_image.png" />

	<meta name="theme-color" content="#ff5f1f" />
	<meta name="darkreader-lock" />
</svelte:head>

<Toaster
	theme={mode.current}
	position="bottom-left"
	toastOptions={{
		unstyled: true,
		classes: {
			toast:
				'bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 shadow-xl text-zinc-900 dark:text-zinc-100 rounded-lg p-4 flex items-center gap-3 min-h-12',
			title: 'text-zinc-900 dark:text-zinc-100 font-medium text-sm',
			description: 'text-zinc-600 dark:text-zinc-400 text-xs',
			actionButton:
				'bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1 text-xs font-medium',
			cancelButton:
				'bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md px-3 py-1 text-xs font-medium',
			closeButton:
				'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-md p-1 ml-auto',
		},
		duration: 5000,
	}}
/>

{@render children()}
