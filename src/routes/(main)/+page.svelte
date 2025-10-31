<script lang="ts">
	import type { DBUser } from '$database/schema';
	import ExpirySelector from '@/src/lib/components/side-panel/expiry-selector.svelte';
	import LanguageSelector from '@/src/lib/components/side-panel/language-selector.svelte';
	import SideBar from '@/src/lib/components/side-panel/side-bar.svelte';
	import UserInviteSelector from '@/src/lib/components/side-panel/user-invite-selector.svelte';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import { type Visibility, visibilityOptions } from '$lib/shared/pastes';
	import { getPublicSiteName } from '$src/lib/utils/format';
	import type { PageData } from './$types';

	interface ActionData {
		errors?: Record<string, string[]>;
		data?: any;
		message?: string;
	}

	let {
		data,
		form,
	}: {
		data: PageData;
		form: ActionData | null;
	} = $props();

	// form state
	let content = $state('');
	let visibility = $state<Visibility>('PUBLIC');
	let customSlug = $state('');
	let language = $state('plaintext');
	let title = $state('');
	let password = $state('');
	let expiry = $state('never');
	let burnAfterReading = $state(false);
	// versioning controls
	let versioningEnabled = $state(false);
	let versionHistoryVisible = $state(false);
	let isSubmitting = $state(false);
	// language selector controls for forked pastes
	let initialLanguage = $state<string | undefined>(undefined);
	// track if fork has been processed to prevent infinite loop
	let forkProcessed = $state(false);

	// invite users state
	let selectedUsers = $state<Partial<DBUser>[]>([]);

	let errors = $state<Record<string, string[]>>({ _form: [] });

	// update errors from form action results
	$effect(() => {
		if (form?.errors) {
			errors = form.errors as Record<string, string[]>;
		} else {
			errors = { _form: [] };
		}
	});

	// handle fork data from server - runs after navigation is complete
	afterNavigate(() => {
		const forkedFromId = page.url.searchParams.get('forkedFrom');

		// only process if we have a forkedFrom param and haven't processed yet
		if (!forkedFromId || forkProcessed) {
			return;
		}

		// mark as processed
		forkProcessed = true;

		// check for fork error first
		if (data.forkError) {
			toast.error(data.forkError);
			// clean up URL to avoid reforking on refresh
			tick().then(() => {
				const newUrl = new URL(page.url);
				newUrl.searchParams.delete('forkedFrom');
				replaceState(resolve(newUrl.toString() as Pathname), {});
			});
			return;
		}

		// handle successful fork
		if (data.forkedPasteData) {
			const forkData = data.forkedPasteData;

			// auto-fill form with forked paste data
			content = forkData.content;
			language = forkData.language || 'plaintext';
			initialLanguage = forkData.language || 'plaintext';
			title = forkData.title || '';
			visibility = forkData.visibility as Visibility;
			customSlug = ''; // dont copy custom slug
			versioningEnabled = forkData.versioningEnabled ?? false;
			versionHistoryVisible = forkData.versionHistoryVisible ?? false;
			burnAfterReading = forkData.burnAfterReading ?? false;

			// handle invited users for INVITE_ONLY pastes
			if (forkData.invitedUsers && forkData.invitedUsers.length > 0) {
				// use full user objects with usernames
				selectedUsers = forkData.invitedUsers;
			}

			// handle expiry
			if (forkData.expiresAt) {
				// calculate remaining time and set appropriate expiry value
				const expiresDate = new Date(forkData.expiresAt);
				const now = new Date();
				const diffMs = expiresDate.getTime() - now.getTime();

				if (diffMs > 0) {
					// preserve approximate expiry timeframe
					const diffDays = diffMs / (1000 * 60 * 60 * 24);
					if (diffDays >= 365) {
						expiry = '1y';
					} else if (diffDays >= 30) {
						expiry = '1M';
					} else if (diffDays >= 7) {
						expiry = '1w';
					} else if (diffDays >= 1) {
						expiry = '1d';
					} else {
						expiry = '1h';
					}
				}
			}

			// show success toast
			toast.success('Paste forked! You can now edit and create a new paste.');

			tick().then(() => {
				// clean up URL parameters to avoid reforking on refresh
				const newUrl = new URL(page.url);
				newUrl.searchParams.delete('forkedFrom');
				replaceState(resolve(newUrl.toString() as Pathname), {});
			});
		}
	});
</script>

<svelte:head>
	<title>{getPublicSiteName()}</title>
</svelte:head>

{#if data.error}
	<div class="mb-6 rounded-md bg-destructive/15 p-4 text-destructive">
		<p>{data.error}</p>
	</div>
{/if}

{#if !data.canCreatePastes}
	<div class="absolute inset-0 top-[10%] -z-10 flex items-start justify-center">
		<enhanced:img
			src="/static/favicon-512x.png"
			alt={getPublicSiteName()}
			class="h-96 w-96 object-cover"
		/>
	</div>
	<div
		class="flex h-screen items-center justify-center"
		style="height: calc(100vh - var(--navbar-height, 56px)); overflow: hidden;"
	>
		<div
			class="flex max-w-md flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-lg"
		>
			<p class="text-muted-foreground">
				{#if data.user}
					You don't have permission to create pastes. Contact the server administrator for
					assistance.
				{:else}
					<span class="pb-4"> You must be logged in to create pastes. </span>
				{/if}
			</p>
			{#if !data.user}
				<Button href="/signin" class="bg-primary hover:bg-primary/90">Sign In</Button>
			{/if}
		</div>
	</div>
{:else}
	<form
		method="POST"
		action="?/createPaste"
		use:enhance={() => {
			isSubmitting = true;
			errors = { _form: [] };

			const toastId = toast.loading('Creating paste...');

			return async ({ result, update }) => {
				isSubmitting = false;
				toast.dismiss(toastId);

				if (result.type === 'failure') {
					if (result.data?.errors) {
						errors = result.data.errors as Record<string, string[]>;
					}
					toast.error((result?.data?.message as string) || 'Failed to create paste');
				} else if (result.type === 'redirect') {
					toast.success('Paste created successfully!');
				} else if (result.type === 'error') {
					toast.error('An error occurred while creating paste');
				}

				await update({ reset: false });
			};
		}}
		class="flex h-screen"
		style="height: calc(100vh - var(--navbar-height, 56px)); overflow: hidden;"
	>
		<!-- Left Prompt Panel -->
		<div id="prompt" class="flex items-start px-4 pb-4 pt-2">
			<div class="text-lg font-extrabold">&gt;</div>
		</div>

		<!-- Main Editor Area -->
		<div class="flex-1">
			<Textarea
				name="content"
				bind:value={content}
				disabled={isSubmitting}
				enableTabKey
				spellcheck={false}
				placeholder="Enter your text or code here..."
				class="h-full w-full resize-none overflow-y-auto border-0 bg-transparent font-mono !text-lg outline-none focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"
				style="border: none !important; outline: none !important; box-shadow: none !important;"
			/>
		</div>

		<!-- Right Panel -->
		<SideBar>
			<!-- Title -->
			<div>
				<h3 class="mb-3 text-sm font-semibold tracking-wider text-foreground">Title</h3>
				<Input
					name="title"
					bind:value={title}
					disabled={isSubmitting}
					placeholder="Enter paste title..."
					class="border-border bg-background text-sm"
					maxlength={255}
				/>
			</div>

			<!-- Visibility -->
			<div class="border-t border-border pt-4">
				<h3 class="mb-3 text-sm font-semibold tracking-wider text-foreground">Visibility</h3>

				{#if !data.user}
					<!-- Notice for unauthenticated users -->
					<div
						class="mb-3 flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-orange-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-orange-200"
					>
						<p class="text-sm">
							<span class="font-semibold">Note:</span> Without an account, you can only create PUBLIC
							pastes. Your paste cannot be edited or deleted after creation.
						</p>
					</div>
				{/if}

				<Select type="single" bind:value={visibility} disabled={isSubmitting || !data.user}>
					<SelectTrigger class="border-border bg-background text-sm">
						{visibilityOptions.find((opt) => opt.value === visibility)?.label ||
							'Select visibility'}
					</SelectTrigger>
					<SelectContent>
						{#each visibilityOptions as option (option.value)}
							<SelectItem value={option.value} class="cursor-pointer">
								<div class="font-semibold">{option.label}</div>
								<div class="pl-2 text-sm text-muted-foreground">{option.description}</div>
							</SelectItem>
						{/each}
					</SelectContent>
				</Select>

				{#if visibility === 'INVITE_ONLY'}
					<UserInviteSelector {visibility} bind:selectedUsers />
				{/if}
			</div>

			<!-- Language Selector -->
			<LanguageSelector
				pasteContent={content}
				bind:language
				{initialLanguage}
				initialAutoDetectState={data?.forkedPasteData?.language ? false : true}
				disabled={isSubmitting}
			/>

			<!-- Expiry -->
			<ExpirySelector
				bind:expiry
				includeNoChange={false}
				disabled={isSubmitting}
				forceExpiry={data.forceExpiry}
				forceExpiryValue={data.forceExpiryValue}
			/>

			<!-- Options -->
			<div class="border-t border-border pt-4">
				<h3 class="mb-3 text-sm font-semibold tracking-wider text-foreground">Options</h3>

				<!-- Delete After Reading -->
				<div class="mb-4 flex items-center space-x-3">
					<Checkbox
						bind:checked={burnAfterReading}
						class="border-border data-[state=checked]:border-orange-500 data-[state=checked]:bg-orange-500"
						disabled={isSubmitting}
					/>
					<span class="text-sm font-medium"
						><span class="font-semibold text-primary">Burn</span> after reading</span
					>
				</div>

				<!-- Custom URL -->
				<div class="mb-4 space-y-2">
					<h3 class="mb-3 text-sm tracking-wider text-foreground">Custom URL (optional)</h3>
					<Input
						name="customSlug"
						bind:value={customSlug}
						placeholder="my-custom-url"
						class="border-border bg-background text-sm"
						disabled={isSubmitting}
						autocomplete="off"
					/>
					{#if errors.customSlug && errors.customSlug.length > 0}
						<p class="text-sm text-red-400">{errors.customSlug[0]}</p>
					{/if}
				</div>

				<!-- Password -->
				<div class="space-y-2">
					<h3 class="mb-3 text-sm tracking-wider text-foreground">Password (optional)</h3>
					<Input
						name="password"
						bind:value={password}
						placeholder="Enter password..."
						type="password"
						class="border-border bg-background text-sm"
						disabled={isSubmitting}
						autocomplete="off"
						maxlength={100}
					/>
				</div>

				<!-- Versioning -->
				<div class="mt-4 space-y-3">
					<div class="flex items-center gap-3">
						<Checkbox bind:checked={versioningEnabled} disabled={isSubmitting} />
						<div class="flex-1" class:text-muted-foreground={isSubmitting}>
							<div class="text-sm font-semibold">Enable versioning</div>
							<div class="text-xs text-muted-foreground">
								Enables versioning for this paste, private unless "Allow viewers to see history" is
								enabled.
							</div>
						</div>
					</div>
					<div class="flex items-center gap-3 opacity-100 disabled:opacity-50">
						<Checkbox
							bind:checked={versionHistoryVisible}
							disabled={!versioningEnabled || isSubmitting}
						/>
						<div class="flex-1" class:text-muted-foreground={isSubmitting}>
							<div class="text-sm font-semibold">Allow viewers to see history</div>
							<div class="text-xs text-muted-foreground">
								This setting allows anyone with access to view this paste to view the version
								history.
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Form Errors -->
			{#if errors._form && errors._form.length > 0}
				<div class="mt-4 rounded-md bg-red-900/50 p-3 text-sm text-red-400">
					<p>{errors._form[0]}</p>
				</div>
			{/if}

			<!-- Actions -->
			<div class="border-t border-border pt-4">
				<Button
					type="submit"
					disabled={isSubmitting || !content.trim()}
					class="h-11 w-full bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600"
				>
					{isSubmitting ? 'Creating...' : 'Create Paste'}
				</Button>
			</div>

			<!-- Hidden fields for form submission -->
			<input type="hidden" name="language" value={language} disabled={isSubmitting} />
			<input type="hidden" name="visibility" value={visibility} disabled={isSubmitting} />
			<input type="hidden" name="customSlug" value={customSlug} disabled={isSubmitting} />
			<input type="hidden" name="expiry" value={expiry} disabled={isSubmitting} />
			<input
				type="hidden"
				name="burnAfterReading"
				value={burnAfterReading}
				disabled={isSubmitting}
			/>
			<input
				type="hidden"
				name="versioningEnabled"
				value={versioningEnabled}
				disabled={isSubmitting}
			/>
			<input
				type="hidden"
				name="versionHistoryVisible"
				value={versionHistoryVisible}
				disabled={isSubmitting}
			/>

			<!-- Hidden fields for invited users -->
			{#each selectedUsers as user (user.id)}
				<input type="hidden" name="invitedUsers" value={user.id} disabled={isSubmitting} />
			{/each}
		</SideBar>
	</form>
{/if}
