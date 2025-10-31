<script lang="ts">
	import type { DBUser } from '$database/schema';
	import { type RoleName } from '@/src/lib/auth/roles-shared';
	import { ArrowLeft, Eye, EyeOff } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Textarea } from '$lib/components/ui/textarea';
	import { securePasswordSignUp } from '$lib/shared/auth';
	import { ROUTES } from '$src/lib/routes';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$components/ui/select';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let user = $derived(data.user as DBUser);
	let roles = data.roles;

	// form values - initialize with user data
	let username = $derived(user?.displayUsername || user?.username || '');
	let email = $derived(user?.email || '');
	let role = $derived(user?.role || '');
	let banned = $derived(user?.banned || false);
	let banReason = $derived(user?.banReason || '');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showPasswords = $state(false);

	let isSubmitting = $state(false);
	let formIsDirty = $derived.by(() => {
		return (
			(username !== '' && username.trim().toLowerCase() !== user?.username.trim().toLowerCase()) ||
			(email !== '' && email.trim().toLowerCase() !== user?.email.trim().toLowerCase()) ||
			(role !== '' && role !== user?.role) ||
			(user?.banned !== undefined && banned !== user?.banned) ||
			banReason !== (user?.banReason || '') ||
			newPassword !== '' ||
			confirmPassword !== ''
		);
	});

	// update form values when user data changes
	$effect(() => {
		if (user) {
			username = user.displayUsername || user.username;
			email = user.email;
			role = user.role || '';
			banned = user.banned || false;
			banReason = user.banReason || '';
		}
	});

	// handle navigation within SvelteKit
	beforeNavigate((navigation) => {
		if (formIsDirty && !isSubmitting && !navigation.willUnload) {
			if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
				navigation.cancel();
			}
		}
	});

	// form errors
	let errors = $state<Record<string, string[]>>({ _form: [] });
</script>

<svelte:window
	on:beforeunload={(ev) => {
		if (formIsDirty && !isSubmitting) {
			ev.preventDefault();
			// older browser compatibility
			ev.returnValue = '';
			return '';
		}
	}}
/>

<div class="container mx-auto px-4">
	<div class="mx-auto mb-6 flex max-w-2xl items-center justify-between">
		<h1 class="text-3xl font-bold">Edit User</h1>
		<a
			href={resolve(ROUTES.ADMIN.USERS.BASE as Pathname)}
			class="flex items-center gap-2 text-sm text-primary hover:underline"
		>
			<ArrowLeft size={16} />
			<span>Back to User List</span>
		</a>
	</div>

	<div class="mx-auto max-w-2xl">
		<Card class="bg-white dark:bg-zinc-900/90">
			<CardHeader>
				<CardTitle>Edit User</CardTitle>
				<CardDescription>Update user information and role assignment</CardDescription>
			</CardHeader>
			<CardContent>
				{#if data.error}
					<div class="mb-4 rounded-md bg-destructive/15 p-4 text-destructive">
						<p>{data.error}</p>
					</div>
				{/if}

				{#if !user}
					<div class="mb-4 rounded-md bg-destructive/15 p-4 text-destructive">
						<p>User not found</p>
					</div>
				{:else}
					<form
						method="POST"
						use:enhance={({ cancel }) => {
							// client-side validation for password
							if (newPassword && newPassword.length > 0) {
								// validate password meets security requirements
								const passwordValidation = securePasswordSignUp.safeParse(newPassword);
								if (!passwordValidation.success) {
									const errorMessage =
										passwordValidation.error.issues[0]?.message || 'Invalid password';
									errors = {
										newPassword: [errorMessage],
									};
									// cancel form submission immediately
									cancel();
									return;
								}

								// check password matching
								if (!confirmPassword || newPassword !== confirmPassword) {
									errors = {
										confirmPassword: ['Passwords do not match'],
									};
									// cancel form submission immediately
									cancel();
									return;
								}
							}

							// if validation passes, proceed with submission
							isSubmitting = true;
							errors = { _form: [] };
							const toastId = toast.loading('Updating user...');

							return async ({ result, update }) => {
								isSubmitting = false;
								toast.dismiss(toastId);

								if (result.type === 'failure') {
									if (result.data?.errors) {
										errors = result.data.errors as Record<string, string[]>;
									}
									toast.error((result?.data?.message as string) || 'Failed to update user');
								} else if (result.type === 'success') {
									if (result.data?.success) {
										toast.success(result?.data?.message?.toString() || 'User updated successfully');
									} else {
										toast.success('User updated successfully');
									}
									// clear password fields on successful update
									newPassword = '';
									confirmPassword = '';
									// Update user data to reflect the submitted values
									user = {
										...user,
										username: username.trim(),
										displayUsername: username.trim(),
										email: email.trim(),
										role: (role || null) as RoleName | null,
										banned: banned,
										banReason: banReason,
									};

									await invalidateAll();
								} else if (result.type === 'error') {
									toast.error('An error occurred while updating user');
								}

								await update({ reset: false });
							};
						}}
						class="space-y-4"
					>
						<div class="space-y-2">
							<Label for="username">Username</Label>
							<Input
								id="username"
								name="username"
								type="text"
								bind:value={username}
								placeholder="Enter username"
								class={errors.username ? 'border-destructive' : ''}
								required
							/>
							{#if errors.username}
								<p class="text-sm text-destructive">{errors.username[0]}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="email">Email (optional)</Label>
							<Input
								id="email"
								name="email"
								type="email"
								bind:value={email}
								placeholder="Enter email address"
								class={errors.email ? 'border-destructive' : ''}
							/>
							{#if errors.email}
								<p class="text-sm text-destructive">{errors.email[0]}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="role">Role</Label>
							<Select type="single" name="role" bind:value={role}>
								<SelectTrigger class={errors.role ? 'border-destructive' : ''}>
									{role
										? Object.values(roles)
												.find((r: RoleName) => r === role)
												?.toString() || 'Select a role'
										: 'Select a role'}
								</SelectTrigger>
								<SelectContent>
									{#each Object.values(roles) as role (role)}
										<SelectItem value={role ? role.toString() : ''}
											>{role ? role.toString() : ''}</SelectItem
										>
									{/each}
								</SelectContent>
							</Select>
							{#if errors.role}
								<p class="text-sm text-destructive">{errors.role[0]}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="newPassword">New Password (optional)</Label>
							<div class="relative">
								<Input
									id="newPassword"
									name="newPassword"
									type={showPasswords ? 'text' : 'password'}
									bind:value={newPassword}
									placeholder="Enter new password"
									class="pr-10 {errors.newPassword ? 'border-destructive' : ''}"
								/>
								<button
									type="button"
									onclick={() => (showPasswords = !showPasswords)}
									class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									tabindex="-1"
								>
									{#if showPasswords}
										<EyeOff size={18} />
									{:else}
										<Eye size={18} />
									{/if}
								</button>
							</div>
							{#if errors.newPassword}
								<p class="text-sm text-destructive">{errors.newPassword[0]}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="confirmPassword">Confirm Password (optional)</Label>
							<div class="relative">
								<Input
									id="confirmPassword"
									name="confirmPassword"
									type={showPasswords ? 'text' : 'password'}
									bind:value={confirmPassword}
									placeholder="Confirm new password"
									class="pr-10 {errors.confirmPassword ? 'border-destructive' : ''}"
								/>
								<button
									type="button"
									onclick={() => (showPasswords = !showPasswords)}
									class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									tabindex="-1"
								>
									{#if showPasswords}
										<EyeOff size={18} />
									{:else}
										<Eye size={18} />
									{/if}
								</button>
							</div>
							{#if errors.confirmPassword}
								<p class="text-sm text-destructive">{errors.confirmPassword[0]}</p>
							{/if}
						</div>

						<div class="space-y-4 border-t pt-4">
							<div class="flex items-center justify-between">
								<div class="space-y-1">
									<Label for="banned">Ban User</Label>
									<p class="text-sm text-muted-foreground">
										{banned ? 'User is currently banned' : 'User is not banned'}
									</p>
								</div>
								<Switch id="banned" name="banned" bind:checked={banned} />
							</div>

							{#if banned}
								<div class="space-y-2">
									<Label for="banReason">Ban Reason (optional)</Label>
									<Textarea
										id="banReason"
										name="banReason"
										bind:value={banReason}
										placeholder="Enter reason for ban (optional)"
										class={errors.banReason ? 'border-destructive' : ''}
										rows={3}
									/>
									{#if errors.banReason}
										<p class="text-sm text-destructive">{errors.banReason[0]}</p>
									{/if}
								</div>
							{/if}
						</div>

						{#if errors._form && errors._form.length > 0}
							<div class="rounded-md bg-destructive/15 p-3 text-destructive">
								<p>{errors._form[0]}</p>
							</div>
						{/if}

						<CardFooter class="flex justify-end gap-2 px-0 pt-4">
							<Button type="button" variant="outline" href={ROUTES.ADMIN.USERS.BASE}>Cancel</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? 'Updating...' : 'Update User'}
							</Button>
						</CardFooter>
					</form>
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
