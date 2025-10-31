<script lang="ts">
	import type { DBUser } from '$database/schema';
	import { type Visibility, visibilityOptions } from '@/src/lib/shared/pastes';
	import { formatDateRelativeToNow, getPublicSiteName } from '@/src/lib/utils/format';
	import { ArrowLeft, Calendar, Eye, Hash, LockIcon, Save, User } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import ExpiresAtWarning from '$lib/components/side-panel/expires-at-warning.svelte';
	import ExpirySelector from '$lib/components/side-panel/expiry-selector.svelte';
	import LanguageSelector from '$lib/components/side-panel/language-selector.svelte';
	import SideBar from '$lib/components/side-panel/side-bar.svelte';
	import UserInviteSelector from '$lib/components/side-panel/user-invite-selector.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import Switch from '$components/ui/switch/switch.svelte';
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

	// form state pre-filled with existing data
	let content = $state(data.paste.content || '');
	let visibility = $state<Visibility>(data.paste.visibility || 'PUBLIC');
	let customSlug = $state(data.paste.customSlug || '');
	let language = $state(data.paste.language || 'plaintext');
	let title = $state(data.paste.title || '');
	let password = $state('');
	let expiry = $state('');
	let burnAfterReading = $state(data.paste.burnAfterReading || false);
	// versioning controls
	let versioningEnabled = $state(data.paste.versioningEnabled ?? false);
	let versionHistoryVisible = $state(data.paste.versionHistoryVisible ?? false);
	let isSubmitting = $state(false);
	let isSuccessfullySubmitted = $state(false);

	let changePassword = $state(false);

	// invite users state
	let selectedUsers = $state<Partial<DBUser>[]>([]);
	let removedUsers = $state<string[]>([]);

	// original values for dirty form detection
	const originalValues = {
		content: data.paste.content || '',
		visibility: data.paste.visibility || 'PUBLIC',
		customSlug: data.paste.customSlug || '',
		language: data.paste.language || 'plaintext',
		title: data.paste.title || '',
		expiry: '',
		burnAfterReading: data.paste.burnAfterReading || false,
	};

	// dirty form tracking
	let hasUnsavedChanges = $derived(
		content !== originalValues.content ||
			visibility !== originalValues.visibility ||
			customSlug !== originalValues.customSlug ||
			language !== originalValues.language ||
			title !== originalValues.title ||
			expiry !== originalValues.expiry ||
			burnAfterReading !== originalValues.burnAfterReading ||
			password !== '' || // password field being filled means there are changes
			selectedUsers.length > 0 || // any selected users means there are changes
			removedUsers.length > 0 // any removed users means there are changes
	);

	let errors = $state<Record<string, string[]>>({ _form: [] });

	// update errors from form action results
	$effect(() => {
		if (form?.errors) {
			errors = form.errors as Record<string, string[]>;
		} else {
			errors = { _form: [] };
		}
	});

	// handle navigation away from page with unsaved changes
	beforeNavigate(({ cancel }) => {
		if (hasUnsavedChanges && !isSubmitting && !isSuccessfullySubmitted) {
			if (!confirm('You have unsaved changes. Are you sure you want to leave this page?')) {
				cancel();
			}
		}
	});

	// handle browser tab/window close with unsaved changes
	$effect(() => {
		if (!browser) return;

		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (hasUnsavedChanges && !isSubmitting && !isSuccessfullySubmitted) {
				e.preventDefault();
				e.returnValue = 'You have unsaved changes. Are you sure you want to leave this page?';
				return e.returnValue;
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});
</script>

<svelte:head>
	<title
		>Edit: {data.paste.title || `Paste ${data.paste.customSlug || data.paste.id}`} - {getPublicSiteName()}</title
	>
</svelte:head>

<form
	method="POST"
	action="?/updatePaste"
	use:enhance={async () => {
		isSubmitting = true;
		errors = { _form: [] };

		const toastId = toast.loading('Updating paste...');

		return async ({ result, update }) => {
			isSubmitting = false;
			toast.dismiss(toastId);

			if (result.type === 'failure') {
				if (result.data?.errors) {
					errors = result.data.errors as Record<string, string[]>;
				}
				if (
					result?.data?.message &&
					!result.data.message.toString().toLowerCase().includes('rate limit')
				) {
					toast.error(result?.data?.message as string);
				}
			} else if (result.type === 'redirect') {
				toast.success('Paste updated successfully!');
				// Clear unsaved changes flag on successful submission
				isSuccessfullySubmitted = true;
			} else if (result.type === 'error') {
				toast.error('An error occurred while updating paste');
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

	<SideBar>
		<!-- Header Section -->
		<div class="space-y-3">
			<h1 class="text-lg font-semibold text-foreground">Edit Paste</h1>
			<Button
				variant="outline"
				onclick={(e) => {
					if (hasUnsavedChanges && !isSuccessfullySubmitted) {
						e.preventDefault();
						if (confirm('You have unsaved changes. Are you sure you want to leave this page?')) {
							window.location.href = `/${data.paste.customSlug || data.paste.id}`;
						}
					}
				}}
				href="/{data.paste.customSlug || data.paste.id}"
				class="flex w-full items-center gap-2 text-sm"
				disabled={isSubmitting}
			>
				<ArrowLeft size={14} />
				Back to Paste
			</Button>
		</div>

		<!-- Non-editable Info Section -->
		<div class="space-y-4 rounded-lg bg-muted p-4">
			<h3 class="text-sm font-semibold uppercase tracking-wider text-foreground">
				Paste Information
			</h3>

			<!-- Version -->
			<div class="flex items-center gap-3">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background"
				>
					<span class="text-xs font-bold text-foreground">v</span>
				</div>
				<div>
					<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Version
					</div>
					<div class="text-sm font-semibold text-foreground">
						{data.paste.currentVersion}{data.paste.versioningEnabled &&
						content !== originalValues.content
							? ` → ${data.paste.currentVersion + 1}`
							: ''}
					</div>
				</div>
			</div>

			<!-- Views -->
			<div class="flex items-center gap-3">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background"
				>
					<Eye size={14} class="text-muted-foreground" />
				</div>
				<div>
					<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Views</div>
					<div class="text-sm font-semibold text-foreground">
						{data.paste.views.toLocaleString()}
					</div>
				</div>
			</div>

			<!-- Created -->
			<div class="flex items-center gap-3">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background"
				>
					<Calendar size={14} class="text-muted-foreground" />
				</div>
				<div>
					<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Created
					</div>
					<div class="text-sm font-semibold text-foreground">
						{formatDateRelativeToNow(data.paste.createdAt)}
					</div>
				</div>
			</div>

			<!-- Paste ID -->
			<div class="flex items-center gap-3">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background"
				>
					<Hash size={14} class="text-muted-foreground" />
				</div>
				<div class="min-w-0 flex-1">
					<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Paste ID
					</div>
					<div class="break-all font-mono text-sm font-semibold text-foreground">
						{data.paste.id}
					</div>
				</div>
			</div>

			<!-- Owner -->
			<div class="flex items-center gap-3">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background"
				>
					<User size={14} class="text-muted-foreground" />
				</div>
				<div>
					<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Owner</div>
					<div class="text-sm font-semibold text-foreground">
						@{data.paste.ownerUsername}
					</div>
				</div>
			</div>
			<!-- Password -->
			<div class="flex items-center gap-3">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background"
				>
					<LockIcon size={14} class="text-muted-foreground" />
				</div>
				<div>
					<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Password Protected
					</div>
					<div class="text-sm font-semibold text-foreground">
						{data.paste.hasPassword ? 'Yes' : 'No'}
					</div>
				</div>
			</div>
		</div>

		<!-- Title -->
		<div>
			<h3 class="mb-3 text-sm font-semibold tracking-wider text-foreground">Title</h3>
			<Input
				name="title"
				bind:value={title}
				placeholder="Enter paste title..."
				class="border-border bg-background text-sm"
				disabled={isSubmitting}
			/>
		</div>

		<!-- Visibility -->
		<div class="border-t border-border pt-4">
			<h3 class="mb-3 text-sm font-semibold tracking-wider text-foreground">Visibility</h3>
			<Select type="single" bind:value={visibility} disabled={isSubmitting}>
				<SelectTrigger class="border-border bg-background text-sm">
					{visibilityOptions.find((opt) => opt.value === visibility)?.label || 'Select visibility'}
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
				<UserInviteSelector
					{visibility}
					bind:removedUsers
					bind:selectedUsers
					invitedUsers={data.invitedUsers}
					pasteId={data.paste.id}
					disabled={isSubmitting}
				/>
			{/if}
		</div>

		<!-- Language Selector -->
		<LanguageSelector
			initialLanguage={data.paste.language}
			pasteContent={content}
			bind:language
			disabled={isSubmitting}
		/>

		<!-- Expiry -->
		{#if data.forceExpiry}
			<!-- Show expiry warning only when forced -->
			<div class="border-t border-border pt-4">
				<h3 class="mb-3 text-sm font-semibold tracking-wider text-foreground">Expiry</h3>
				<ExpiresAtWarning currentExpiresAt={data.paste.expiresAt} />
				<div
					class="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
				>
					<div class="font-semibold">Server-enforced expiry</div>
					<div>Expiry time is managed by the server administrator and cannot be changed.</div>
				</div>
			</div>
		{:else}
			<!-- Show normal expiry selector when not forced -->
			<ExpirySelector bind:expiry currentExpiresAt={data.paste.expiresAt} disabled={isSubmitting} />
		{/if}

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
				{#if data.paste.hasPassword}
					<div
						class="mb-2 flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
					>
						<svg class="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
								clip-rule="evenodd"
							/>
						</svg>
						<span>This paste is currently password protected.</span>
					</div>
					<div class="flex flex-row items-center justify-between">
						<label for="passwordProtectedSwitch" class="text-sm font-semibold"
							>Change password?</label
						>
						<Switch bind:checked={changePassword} disabled={isSubmitting} />
					</div>
				{/if}
				<Input
					name="password"
					bind:value={password}
					placeholder="Enter password..."
					type="password"
					class="border-border bg-background text-sm"
					disabled={isSubmitting || (!changePassword && data.paste.hasPassword)}
					autocomplete="off"
				/>
			</div>

			<!-- Versioning -->
			<div class="mt-4 space-y-3">
				<div class="flex items-center gap-3">
					<Checkbox
						bind:checked={versioningEnabled}
						onchange={(e: Event) => {
							const target = e.currentTarget as HTMLInputElement | null;
							if (target && !target.checked) {
								if (
									!confirm(
										'Turning off versioning deletes all stored versions and resets version to 1. Proceed?'
									)
								) {
									target.checked = true;
									versioningEnabled = true;
								}
							}
						}}
						disabled={isSubmitting}
					/>
					<div class="flex-1" class:text-muted-foreground={isSubmitting}>
						<div class="text-sm font-semibold">Enable versioning</div>
						<div class="text-xs">
							Enables versioning for this paste, private unless "Allow viewers to see history" is
							enabled.
						</div>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<Checkbox
						bind:checked={versionHistoryVisible}
						disabled={!versioningEnabled || isSubmitting}
					/>
					<div class="flex-1" class:text-muted-foreground={isSubmitting}>
						<div class="text-sm font-semibold">Allow viewers to see history</div>
						<div class="text-xs">
							This setting allows anyone with access to view this paste to view the version history.
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
				<Save size={16} />
				{isSubmitting ? 'Updating...' : 'Update Paste'}
			</Button>
		</div>

		<!-- Hidden fields for form submission -->
		<input type="hidden" name="language" value={language} disabled={isSubmitting} />
		<input type="hidden" name="visibility" value={visibility} disabled={isSubmitting} />
		<input type="hidden" name="customSlug" value={customSlug} disabled={isSubmitting} />
		{#if expiry}
			<input type="hidden" name="expiry" value={expiry} disabled={isSubmitting} />
		{/if}
		<input type="hidden" name="burnAfterReading" value={burnAfterReading} disabled={isSubmitting} />
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
		<input type="hidden" name="changePassword" value={changePassword} disabled={isSubmitting} />
		<!-- Hidden fields for invited users -->
		{#each selectedUsers as user (user.id)}
			<input type="hidden" name="invitedUsers" value={user.id} disabled={isSubmitting} />
		{/each}

		<!-- Hidden fields for removed users -->
		{#each removedUsers as userId (userId)}
			<input type="hidden" name="removedUsers" value={userId} disabled={isSubmitting} />
		{/each}
	</SideBar>
</form>
