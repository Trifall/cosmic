<script lang="ts">
	import { House } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { authClient } from '$src/lib/auth-client.js';
	import { ROUTES } from '$src/lib/routes.js';
	import { getPublicSiteName } from '$src/lib/utils/format';
	import { Button } from '$components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { user, banned, banReason } = data;

	const session = authClient.useSession();

	// get error message from the page error or URL query parameters
	let error =
		page.url.searchParams.get('message') ||
		page.url.searchParams.get('error') ||
		page.error?.message ||
		'An unknown error occurred';

	const handleSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					// push route to home
					goto(resolve(ROUTES.AUTH.SIGNIN as Pathname));
				},
			},
		});
	};
</script>

<svelte:head>
	<title>Error | {getPublicSiteName()}</title>
</svelte:head>

<div class="absolute inset-0 -z-10 flex items-start justify-center">
	<enhanced:img
		src="/static/favicon-512x.png"
		alt={getPublicSiteName()}
		class="h-96 w-96 object-cover"
	/>
</div>

<div class="flex min-h-screen items-center justify-center p-4">
	<Card class="w-full max-w-md">
		<CardHeader>
			<CardTitle>Error</CardTitle>
			{#if !error}
				<CardDescription>Something went wrong</CardDescription>
			{/if}
		</CardHeader>
		<CardContent>
			{#if banned}
				<div class="flex flex-col justify-center space-y-4">
					<span class="text-lg font-bold text-destructive">Your account has been banned.</span>
					{#if banReason}
						<div
							class="max-h-96 overflow-y-auto whitespace-pre-line rounded-lg border p-2 text-destructive"
						>
							Ban Reason: {banReason}
						</div>
					{/if}
					<span class="font-semibold text-foreground"
						>Contact the administrator for more information.</span
					>
				</div>
			{:else if error}
				<div class="mb-6 max-h-96 overflow-y-auto whitespace-pre-line text-destructive">
					{error}
				</div>
			{/if}
			{#if user}
				<!-- User is logged in, tell them about who they are -->
				<p class="my-6 text-foreground">
					You are logged in as <span class="font-semibold">{user.username}</span>
				</p>
			{/if}

			<div class="flex gap-4">
				{#if !banned}
					<!-- Back to home -->
					<Button
						href={resolve(ROUTES.HOME as Pathname)}
						variant="outline"
						class="flex items-center gap-2"
					>
						<House class="h-4 w-4" />
						Back to Home
					</Button>
				{/if}

				<!-- Sign out -->
				{#if user && $session?.data}
					<Button type="button" onclick={() => handleSignOut()} class="w-fit" variant="destructive"
						>Sign out</Button
					>
				{/if}
				{#if !user || !$session?.data}
					<Button
						type="button"
						onclick={() => goto(resolve(ROUTES.AUTH.SIGNIN as Pathname))}
						class="w-fit"
						variant="default">Sign in</Button
					>
				{/if}
			</div>
		</CardContent>
	</Card>
</div>
