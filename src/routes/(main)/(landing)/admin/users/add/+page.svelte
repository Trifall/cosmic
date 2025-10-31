<script lang="ts">
	import { type RoleName, RoleNames } from '@/src/lib/auth/roles-shared';
	import { ArrowLeft } from '@lucide/svelte';
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
	import { ROUTES } from '$src/lib/routes';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$components/ui/select';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let roles = $derived(data.roles);

	const defaultRole =
		Object.values(data.roles)
			.find((r: RoleName) => r === RoleNames.user)
			?.toString() || '';

	// form values
	let username = $state('');
	let email = $state('');
	let password = $state('');
	let role = $state(defaultRole);

	let isSubmitting = $state(false);
	let isSuccess = $state(false);
	let formIsDirty = $derived.by(() => {
		return (
			username !== '' || email !== '' || password !== '' || (role !== '' && defaultRole !== role)
		);
	});

	// handle navigation within SvelteKit
	beforeNavigate((navigation) => {
		if (formIsDirty && !isSubmitting && !isSuccess && !navigation.willUnload) {
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
		if (formIsDirty && !isSubmitting && !isSuccess) {
			ev.preventDefault();
			// older browser compatibility
			ev.returnValue = '';
			return '';
		}
	}}
/>

<div class="container mx-auto py-6">
	<div class="mb-6 flex items-center">
		<a
			href={resolve(ROUTES.ADMIN.USERS.BASE as Pathname)}
			class="flex items-center gap-2 text-sm text-foreground hover:text-primary"
		>
			<ArrowLeft size={16} />
			<span>Back to User List</span>
		</a>
	</div>

	<Card class="mx-auto max-w-2xl bg-white dark:bg-zinc-900/90">
		<CardHeader>
			<CardTitle>Add New User</CardTitle>
			<CardDescription>Create a new user account with role assignment</CardDescription>
		</CardHeader>
		<CardContent>
			{#if data.error}
				<div class="mb-4 rounded-md bg-destructive/15 p-4 text-destructive">
					<p>{(data as { error: string }).error}</p>
				</div>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					isSubmitting = true;
					errors = { _form: [] };
					const toastId = toast.loading('Creating user...');

					return async ({ result, update }) => {
						isSubmitting = false;
						toast.dismiss(toastId);

						if (result.type === 'failure') {
							if (result.data?.errors) {
								errors = result.data.errors as Record<string, string[]>;
							}
							toast.error((result?.data?.message as string) || 'Failed to create user');
						} else if (result.type === 'success') {
							if (result.data?.success) {
								toast.success(result?.data?.message?.toString() || 'User created successfully');
							} else {
								toast.success('User created successfully');
							}
							isSuccess = true; // set success state to disable buttons
							await invalidateAll();
						} else if (result.type === 'error') {
							toast.error('An error occurred while creating user');
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
					<Label for="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						bind:value={password}
						placeholder="Enter password"
						class={errors.password ? 'border-destructive' : ''}
						required
					/>
					{#if errors.password}
						<p class="text-sm text-destructive">{errors.password[0]}</p>
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

				{#if errors._form && errors._form.length > 0}
					<div class="rounded-md bg-destructive/15 p-3 text-destructive">
						<p>{errors._form[0]}</p>
					</div>
				{/if}

				<CardFooter class="flex justify-end gap-2 px-0 pt-4">
					<Button
						type="button"
						variant="outline"
						href={ROUTES.ADMIN.USERS.BASE}
						disabled={isSuccess || isSubmitting}>Cancel</Button
					>
					<Button type="submit" disabled={isSuccess || isSubmitting}>
						{isSubmitting ? 'Creating...' : isSuccess ? 'User Created' : 'Create User'}
					</Button>
				</CardFooter>
			</form>
		</CardContent>
	</Card>
</div>
