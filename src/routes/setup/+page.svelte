<script lang="ts">
	import { Check, Eye, EyeOff, Triangle, TriangleAlert, X } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { getPublicSiteName } from '$src/lib/utils/format';
	import { Button } from '$components/ui/button';
	import * as Card from '$components/ui/card';
	import { Input } from '$components/ui/input';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// helper function to safely get errors from the form
	const getError = (field: string): string[] | undefined => {
		if (!form?.errors) return undefined;
		const errors = form.errors as Record<string, string[]>;
		return errors[field];
	};

	// helper function to safely get form field value
	const getFormValue = (field: 'username' | 'email'): string => {
		if (!form) return '';
		return (form as any)[field] ?? '';
	};

	let showPasswords = $state(false);
	let isSubmitting = $state(false);
	let password = $state('');
	let confirmPassword = $state('');

	// reactive client-side password match validation
	const clientPasswordMismatch = $derived(() => {
		if (confirmPassword && password !== confirmPassword) {
			return 'Passwords do not match';
		}
		return null;
	});

	// check if form is valid for submission
	const isFormValid = $derived(() => {
		return !clientPasswordMismatch();
	});

	// group optional env vars by feature for better organization
	const envVarGroups = $derived(() => {
		const optional = data.envVars.optional;
		return {
			site: optional.filter((v: { key: string; isSet: boolean }) => v.key === 'PUBLIC_SITE_NAME'),
			backups: optional.filter((v: { key: string; isSet: boolean }) =>
				[
					'BACKUPS_DIRECTORY',
					'AWS_ACCESS_KEY_ID',
					'AWS_SECRET_ACCESS_KEY',
					'AWS_REGION',
					'AWS_S3_BUCKET',
					'AWS_S3_KEY_PREFIX',
				].includes(v.key)
			),
			r2: optional.filter((v: { key: string; isSet: boolean }) =>
				[
					'R2_ACCESS_KEY_ID',
					'R2_SECRET_ACCESS_KEY',
					'R2_ACCOUNT_ID',
					'R2_BUCKET_NAME',
					'R2_KEY_PREFIX',
				].includes(v.key)
			),
			deprecated: optional.filter((v: { key: string; isSet: boolean }) =>
				[
					'FORCE_ENABLE_REGISTRATION',
					'EMERGENCY_RESET_USERNAME',
					'EMERGENCY_RESET_PASSWORD',
				].includes(v.key)
			),
		};
	});

	// check if all vars in a group are configured
	const isGroupConfigured = (vars: { key: string; isSet: boolean }[]) => {
		return vars.length > 0 && vars.every((v) => v.isSet);
	};

	// check if any vars in a group are configured
	const hasPartialConfig = (vars: { key: string; isSet: boolean }[]) => {
		return vars.some((v) => v.isSet) && !vars.every((v) => v.isSet);
	};
</script>

<svelte:head>
	<title>First-Time Setup - {getPublicSiteName()}</title>
</svelte:head>

<div class="absolute inset-0 -z-10 flex items-center justify-center">
	<enhanced:img
		src="/static/favicon-512x.png"
		alt={getPublicSiteName()}
		class="h-96 w-96 object-cover opacity-20 dark:opacity-100"
	/>
</div>

<div class="flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-4xl space-y-6">
		<!-- Header -->
		<div class="text-center">
			<div class="mb-2 flex items-center justify-center gap-2">
				<Triangle class="h-8 w-8 fill-primary text-primary" />
				<h1 class="text-4xl font-bold">Welcome to {getPublicSiteName()}</h1>
			</div>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<!-- Admin Account Creation -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Create Administrator Account</Card.Title>
					<Card.Description>This will be an admin user with full system access</Card.Description>
				</Card.Header>
				<Card.Content>
					<form
						method="POST"
						action="?/setupAdmin"
						use:enhance={() => {
							// client-side validation before submission
							if (!isFormValid()) {
								return ({ update }) => update({ reset: false });
							}

							isSubmitting = true;
							return async ({ update }) => {
								await update();
								isSubmitting = false;
							};
						}}
					>
						<div class="grid gap-4">
							<!-- Username -->
							<div class="grid gap-2">
								<label for="username" class="text-sm font-medium">Username</label>
								<Input
									id="username"
									name="username"
									type="text"
									placeholder="Enter a username"
									value={getFormValue('username')}
									class={getError('username') ? 'border-red-500' : ''}
									required
								/>
								{#if getError('username')}
									<p class="text-sm text-red-500">{getError('username')?.[0]}</p>
								{/if}
							</div>

							<!-- Email -->
							<div class="grid gap-2">
								<label for="email" class="text-sm font-medium">Email (optional)</label>
								<Input
									id="email"
									name="email"
									type="email"
									placeholder="Enter an email (optional)"
									value={getFormValue('email')}
									class={getError('email') ? 'border-red-500' : ''}
								/>
								{#if getError('email')}
									<p class="text-sm text-red-500">{getError('email')?.[0]}</p>
								{/if}
							</div>

							<!-- Password -->
							<div class="grid gap-2">
								<label for="password" class="text-sm font-medium">Password</label>
								<div class="relative">
									<Input
										id="password"
										name="password"
										type={showPasswords ? 'text' : 'password'}
										placeholder="Enter a password"
										bind:value={password}
										class="pr-10 {getError('password') ? 'border-red-500' : ''}"
										required
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
								{#if getError('password')}
									<p class="text-sm text-red-500">{getError('password')?.[0]}</p>
								{/if}
							</div>

							<!-- Confirm Password -->
							<div class="grid gap-2">
								<label for="confirmPassword" class="text-sm font-medium">Confirm Password</label>
								<div class="relative">
									<Input
										id="confirmPassword"
										name="confirmPassword"
										type={showPasswords ? 'text' : 'password'}
										placeholder="Confirm your password"
										bind:value={confirmPassword}
										class={`pr-10 ${getError('password_confirmation') || getError('confirmPassword') || clientPasswordMismatch() ? 'border-red-500' : ''}`}
										required
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
								{#if clientPasswordMismatch()}
									<p class="text-sm text-red-500">{clientPasswordMismatch()}</p>
								{:else if getError('password_confirmation') || getError('confirmPassword')}
									<p class="text-sm text-red-500">
										{getError('password_confirmation')?.[0] || getError('confirmPassword')?.[0]}
									</p>
								{/if}
							</div>

							<!-- Submit Button -->
							<Button type="submit" class="w-full" disabled={isSubmitting}>
								{isSubmitting ? 'Creating Account...' : 'Complete Setup'}
							</Button>

							<!-- Form-level errors -->
							{#if getError('_form')}
								<p class="text-sm text-red-500">{getError('_form')?.[0]}</p>
							{/if}
						</div>
					</form>

					<!-- Important Setup Information -->
					<div
						class="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/50 dark:bg-blue-500/10"
					>
						<div class="flex gap-3">
							<div class="space-y-2">
								<p class="flex flex-row gap-2 text-base font-bold text-blue-900 dark:text-blue-100">
									Important Setup Information
								</p>
								<ul class="space-y-1 text-sm text-blue-700 dark:text-blue-200">
									<li>• The user created will automatically become an administrator</li>
									<li>• You can configure optional features later in the admin settings panel</li>
									<li>• All environment variables are validated server-side for security</li>
									<li>• After setup, you can manage users and settings from the admin dashboard</li>
								</ul>
								<div
									class="mt-3 rounded-md border border-orange-200 bg-orange-50 p-1 dark:border-orange-500/50 dark:bg-orange-500/10"
								>
									<p class="text-xs font-medium text-orange-800 dark:text-orange-100">
										Username Restrictions
									</p>
									<p class="mt-1 text-xs text-orange-700 dark:text-orange-200">
										The following usernames are reserved and cannot be used:
										<span class="font-semibold"
											>admin, root, moderator, user, guest, unauthenticated, administrator, owner</span
										>
									</p>
								</div>
							</div>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Environment Configuration Status -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Environment Configuration</Card.Title>
					<Card.Description>
						Status of your environment variables (values are hidden for security)
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<!-- Mandatory Variables -->
					<div>
						<div class="mb-2">
							<!-- warning for forced_first_time_setup -->
							{#if data.envVars.forceFirstTimeSetup}
								<div
									class="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-orange-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-orange-200"
								>
									<svg class="mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
											clip-rule="evenodd"
										/>
									</svg>
									<div class="space-y-2">
										<p class="text-pretty text-sm text-red-500">
											Forced first-time setup is enabled via the env variable.
											<br /><br />Once you complete the setup process, make sure to remove the
											environment variable and restart the server (<code
												>FORCED_FIRST_TIME_SETUP</code
											>).
										</p>
									</div>
								</div>
							{/if}
						</div>
						<h3 class="mb-2 text-base font-semibold text-foreground">Required Variables</h3>
						<div class="space-y-1.5">
							{#each data.envVars.mandatory as envVar (envVar.key)}
								<div
									class="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
								>
									<span class="font-mono text-sm">{envVar.key}</span>
									{#if envVar.isSet}
										<Check class="h-4 w-4 text-green-500" />
									{:else}
										<X class="h-4 w-4 text-red-500" />
									{/if}
								</div>
							{/each}
						</div>
					</div>

					<hr />
					<span class="text-sm font-semibold text-foreground">Optional Variables</span>
					<!-- Site Configuration -->
					{#if envVarGroups().site.length > 0}
						<div>
							<h3 class="mb-2 text-sm font-semibold text-foreground">Site</h3>
							<div class="space-y-1.5">
								{#each envVarGroups().site as envVar (envVar.key)}
									<div
										class="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
									>
										<span class="font-mono text-sm">{envVar.key}</span>
										{#if envVar.isSet}
											<Check class="h-4 w-4 text-green-500" />
										{:else}
											<span class="text-xs text-muted-foreground">Optional</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Backup Configuration -->
					{#if envVarGroups().backups.length > 0}
						<div>
							<div class="mb-2 flex items-center gap-2">
								<h3 class="text-sm font-semibold text-foreground">AWS S3 Backups</h3>
								{#if isGroupConfigured(envVarGroups().backups.filter((v: { key: string; isSet: boolean }) => !v.key.includes('KEY_PREFIX')))}
									<Check class="h-4 w-4 text-green-500" />
								{:else if hasPartialConfig(envVarGroups().backups)}
									<TriangleAlert class="h-4 w-4 text-yellow-500" />
								{/if}
							</div>
							<div class="space-y-1.5">
								{#each envVarGroups().backups as envVar (envVar.key)}
									<div
										class="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
									>
										<span class="font-mono text-sm">{envVar.key}</span>
										{#if envVar.isSet}
											<Check class="h-4 w-4 text-green-500" />
										{:else}
											<span class="text-xs text-muted-foreground">Optional</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- R2 Configuration -->
					{#if envVarGroups().r2.length > 0}
						<div>
							<div class="mb-2 flex items-center gap-2">
								<h3 class="text-sm font-semibold text-foreground">Cloudflare R2 Backups</h3>
								{#if isGroupConfigured(envVarGroups().r2.filter((v: { key: string; isSet: boolean }) => !v.key.includes('KEY_PREFIX')))}
									<Check class="h-4 w-4 text-green-500" />
								{:else if hasPartialConfig(envVarGroups().r2)}
									<TriangleAlert class="h-4 w-4 text-yellow-500" />
								{/if}
							</div>
							<div class="space-y-1.5">
								{#each envVarGroups().r2 as envVar (envVar.key)}
									<div
										class="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
									>
										<span class="font-mono text-sm">{envVar.key}</span>
										{#if envVar.isSet}
											<Check class="h-4 w-4 text-green-500" />
										{:else}
											<span class="text-xs text-muted-foreground">Optional</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Deprecated Variables -->
					{#if envVarGroups().deprecated.some((v: { key: string; isSet: boolean }) => v.isSet)}
						<div>
							<div class="mb-2 flex items-center gap-2">
								<h3 class="text-sm font-semibold text-yellow-600 dark:text-yellow-500">
									Deprecated Variables
								</h3>
								<TriangleAlert class="h-4 w-4 text-yellow-500" />
							</div>
							<p class="mb-2 text-xs text-muted-foreground">
								These variables are no longer needed and can be removed after setup
							</p>
							<div class="space-y-1.5">
								{#each envVarGroups().deprecated as envVar (envVar.key)}
									{#if envVar.isSet}
										<div
											class="flex items-center justify-between rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2"
										>
											<span class="font-mono text-sm">{envVar.key}</span>
											<TriangleAlert class="h-4 w-4 text-yellow-500" />
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
