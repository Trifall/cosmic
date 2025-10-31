<script lang="ts">
	import { USERNAME_PLACEHOLDER } from '@/src/lib/auth/user-management';
	import { ERROR_MESSAGES, signUpSchema } from '@/src/lib/shared/auth';
	import { ArrowLeft, Eye, EyeOff, Triangle } from '@lucide/svelte';
	import type { ErrorContext, ResponseContext } from 'better-auth/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { type Pathname } from '$app/types';
	import { authClient } from '$lib/auth-client';
	import { ROUTES } from '$src/lib/routes';
	import { getPublicSiteName } from '$src/lib/utils/format';
	import { Button } from '$components/ui/button';
	import * as Card from '$components/ui/card';
	import { Input } from '$components/ui/input';
	import { Spinner } from '$components/ui/spinner';

	let { isPublicRegistrationEnabled = true }: { isPublicRegistrationEnabled?: boolean } = $props();

	const session = authClient.useSession();
	let errors = $state<Record<string, string>>({});
	let isLoading = $state(false);
	let showPasswords = $state(false);

	const handleInput = (field: string) => {
		if (errors[field]) {
			delete errors[field];
		}
	};

	const handleSubmit = async (event: Event) => {
		event.preventDefault();
		if (!isPublicRegistrationEnabled) {
			return;
		}
		isLoading = true;

		const formData = new FormData(event.target as HTMLFormElement);
		let email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const password_confirmation = formData.get('password_confirmation') as string;
		const username = formData.get('username') as string;

		// if email is empty, generate a placeholder email using the username
		if (!email || email.trim() === '') {
			email = `${username}${USERNAME_PLACEHOLDER}`;
		}

		const result = signUpSchema.safeParse({
			email,
			password,
			password_confirmation,
			username,
		});

		if (!result.success) {
			errors = {};
			result.error.issues.forEach((issue) => {
				if (
					issue.path[0] &&
					(typeof issue.path[0] === 'string' || typeof issue.path[0] === 'number')
				) {
					errors[issue.path[0].toString()] = issue.message;
				}
			});
			isLoading = false;
			return;
		}

		let signupSuccess = false;

		try {
			await authClient.signUp.email(
				{
					email,
					password,
					name: username,
					username,
					displayUsername: username,
					callbackURL: '/',
				},
				{
					onResponse: async (response: ResponseContext) => {
						// clone response so we dont modify the original
						let response_clone = await response.response.clone().text();

						if (response_clone.includes('User already exists')) {
							errors.email = ERROR_MESSAGES.EMAIL_EXISTS;
						} else if (response_clone.includes('Username already exists')) {
							errors.username = ERROR_MESSAGES.USERNAME_EXISTS;
						}
					},
					onSuccess: async () => {
						signupSuccess = true;
						goto(resolve(ROUTES.DASHBOARD as Pathname));
					},
					onError: (error: ErrorContext) => {
						// check for username validation errors
						if (
							error.error.message.toLowerCase().includes('username is invalid') ||
							error.error.code === 'USERNAME_IS_INVALID'
						) {
							errors.username = ERROR_MESSAGES.USERNAME_NOT_ALLOWED;
						}
						// console.error(`SignUp - onError called: `, error);
					},
				}
			);
			// only clear errors if signup was successful
			if (signupSuccess) {
				errors = {};
			}
		} catch (error) {
			console.error(error);
			if (!errors.email && !errors.username) {
				errors.form = ERROR_MESSAGES.UNKNOWN;
			}
		}
		isLoading = false;
	};
</script>

<div class="absolute inset-0 -z-10 flex items-start justify-center">
	<enhanced:img
		src="/static/favicon-512x.png"
		alt={getPublicSiteName()}
		class="h-96 w-96 object-cover"
	/>
</div>

{#if $session.data}
	<div class="flex min-h-screen flex-col items-center justify-center space-y-6 bg-background px-4">
		<div class="flex flex-col items-center space-y-4 text-center">
			<h1 class="text-3xl font-bold text-foreground">
				Welcome, <span class="text-primary">{$session?.data.user.name}</span>!
			</h1>

			<Spinner size={48} label="" />

			<p class="text-muted-foreground">Loading your dashboard...</p>

			<p class="text-sm text-muted-foreground">
				Not redirected?
				<a
					href={resolve(ROUTES.DASHBOARD as Pathname)}
					class="font-medium text-primary underline-offset-4 hover:underline"
					aria-label="Go to dashboard">Click here</a
				>
			</p>
		</div>
	</div>
{/if}

{#if !$session.data}
	<Card.Root class="mx-auto max-w-sm">
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title class="text-2xl">Create an Account</Card.Title>
				<!-- Home Button -->
				<a
					href={resolve(ROUTES.HOME as Pathname)}
					class="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
					title="Back to home"
				>
					<ArrowLeft class="h-3.5 w-3.5" />
					<Triangle class="h-3.5 w-3.5 fill-primary text-primary" />
				</a>
			</div>
			<Card.Description>
				{#if isPublicRegistrationEnabled}
					Enter your details below to create your account
				{:else}
					Public registration is currently disabled
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if !isPublicRegistrationEnabled}
				<div class="flex flex-col items-center justify-center py-8 text-center">
					<div class="mb-4 text-muted-foreground">
						<svg
							class="mx-auto h-12 w-12 text-muted-foreground/50"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
							></path>
						</svg>
					</div>
					<h3 class="mb-2 text-lg font-semibold text-muted-foreground">Registration Disabled</h3>
					<p class="mb-6 text-sm text-muted-foreground">
						Public registration is currently disabled. Please contact the server administrator to
						create an account.
					</p>
					<div class="text-center text-sm">
						Already have an account?
						<a
							href={resolve(ROUTES.AUTH.SIGNIN as Pathname)}
							class="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
							>Sign in</a
						>
					</div>
				</div>
			{:else}
				<form onsubmit={handleSubmit}>
					<div class="grid gap-4">
						<div class="grid gap-2">
							<label for="username">Username</label>
							<Input
								id="username"
								name="username"
								type="text"
								placeholder="username221"
								class={errors.username ? 'border-red-500' : ''}
								onchange={() => handleInput('username')}
								required
							/>
							{#if errors.username}
								<p class="text-sm text-red-500">{errors.username}</p>
							{/if}
						</div>
						<div class="grid gap-2">
							<label for="email"
								>Email <span class="text-xs text-gray-500 dark:text-gray-400">(optional)</span
								></label
							>
							<Input
								id="email"
								name="email"
								type="email"
								placeholder="username221@example.com"
								class={errors.email ? 'border-red-500' : ''}
								onchange={() => handleInput('email')}
							/>
							{#if errors.email}
								<p class="text-sm text-red-500">{errors.email}</p>
							{/if}
						</div>
						<div class="grid gap-2">
							<div class="flex items-center">
								<label for="password">Password</label>
							</div>
							<div class="relative">
								<Input
									id="password"
									name="password"
									type={showPasswords ? 'text' : 'password'}
									class="pr-10 {errors.password ? 'border-red-500' : ''}"
									onchange={() => handleInput('password')}
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
							{#if errors.password}
								<p class="text-sm text-red-500">{errors.password}</p>
							{/if}
						</div>
						<div class="grid gap-2">
							<div class="flex items-center">
								<label for="password_confirmation">Confirm Password</label>
							</div>
							<div class="relative">
								<Input
									id="password_confirmation"
									name="password_confirmation"
									type={showPasswords ? 'text' : 'password'}
									class="pr-10 {errors.password_confirmation ? 'border-red-500' : ''}"
									onchange={() => handleInput('password_confirmation')}
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
							{#if errors.password_confirmation}
								<p class="text-sm text-red-500">{errors.password_confirmation}</p>
							{/if}
						</div>
						<Button type="submit" class="w-full" disabled={isLoading}>Create Account</Button>
						{#if errors.form}
							<p class="mt-2 text-center text-sm text-red-500">{errors.form}</p>
						{/if}
					</div>
					<div class="mt-4 text-center text-sm">
						Already have an account?
						<a href={resolve(ROUTES.AUTH.SIGNIN as Pathname)} class="underline">Sign in</a>
					</div>
				</form>
			{/if}
		</Card.Content>
	</Card.Root>
{/if}
