<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let {
		onSuccess,
	}: {
		onSuccess?: (pasteData: any) => void;
	} = $props();

	let password = $state('');
	let localError = $state('');
	let localIsLoading = $state(false);
</script>

<div class="fixed inset-0 top-14 flex items-center justify-center bg-background">
	<Card class="mx-auto w-full max-w-md">
		<CardHeader class="text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20"
			>
				<Lock size={32} class="text-orange-600 dark:text-orange-400" />
			</div>
			<CardTitle class="text-2xl">Password Required</CardTitle>
			<CardDescription>
				This paste is password protected. <br /> Please enter the password to continue.
			</CardDescription>
		</CardHeader>
		<CardContent>
			<form
				method="POST"
				action="?/validatePassword"
				use:enhance={() => {
					localIsLoading = true;

					return async ({ result }) => {
						localIsLoading = false;

						if (result.type === 'success') {
							// pass the paste data to the parent component
							if (onSuccess && result.data) {
								onSuccess(result.data);
							}
							return;
						}

						if (result.type === 'failure') {
							const errorMsg = result.data?.error || 'Invalid password';
							localError = String(errorMsg);
							return;
						}

						// redirects shouldnt happen anymore with this approach
						if (result.type === 'redirect') {
							window.location.href = result.location;
							return;
						}
					};
				}}
				class="space-y-4"
			>
				<div class="space-y-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						bind:value={password}
						placeholder="Enter password"
						disabled={localIsLoading}
						autocomplete="off"
						required
						class="w-full"
					/>
					{#if localError}
						<p class="text-sm text-destructive">{localError}</p>
					{/if}
				</div>

				<Button type="submit" disabled={localIsLoading || !password.trim()} class="w-full">
					{#if localIsLoading}
						<div
							class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"
						></div>
					{/if}
					Unlock Paste
				</Button>
			</form>
		</CardContent>
	</Card>
</div>
