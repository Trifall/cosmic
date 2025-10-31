<script lang="ts">
	import { ERROR_MESSAGES, signInSchema } from '@/src/lib/shared/auth';
	import { ArrowLeft, LayoutDashboard, LogOut, Triangle, UserRound } from '@lucide/svelte';
	import type { ErrorContext } from 'better-auth/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { type Pathname } from '$app/types';
	import { authClient } from '$lib/auth-client';
	import { ROUTES } from '$src/lib/routes';
	import { getPublicSiteName } from '$src/lib/utils/format';
	import { Button } from '$components/ui/button';
	import * as Card from '$components/ui/card';
	import { Input } from '$components/ui/input';

	let { redirectTo } = $props();

	const session = authClient.useSession();
	let errors = $state<Record<string, string>>({});
	let isLoading = $state(false);

	const handleInput = (field: string) => {
		if (errors[field]) {
			delete errors[field];
		}
	};

	const handleSubmit = async (event: Event) => {
		event.preventDefault();
		isLoading = true;

		const formData = new FormData(event.target as HTMLFormElement);
		const username = formData.get('username') as string;
		const password = formData.get('password') as string;

		const result = signInSchema.safeParse({ username, password });
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

		try {
			let newErrors = false;
			await authClient.signIn.username(
				{ username, password },
				{
					onError: (error: ErrorContext & { error?: { code?: string } }) => {
						const errorMsg = error.error.message.toLowerCase();
						const errorCode = error.error.code;
						if (errorMsg.includes('user not found')) {
							errors.username = ERROR_MESSAGES.USERNAME_NOT_FOUND;
						} else if (errorMsg.includes('bad request')) {
							errors.form = ERROR_MESSAGES.UNKNOWN;
						} else if (errorCode === 'BANNED_USER') {
							errors.form = ERROR_MESSAGES.BANNED_USER;
						} else {
							errors.form = ERROR_MESSAGES.INVALID_PASSWORD;
						}
						newErrors = true;
					},
				}
			);
			if (!newErrors) {
				errors = {};
				goto(resolve(redirectTo ?? '/', { replaceState: true }));
			}
		} catch (error) {
			console.error(error);
			errors.form = ERROR_MESSAGES.UNKNOWN;
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
	<Card.Root
		class="mx-auto w-full max-w-lg rounded-xl border border-border/40 bg-card/50 p-2 shadow-sm backdrop-blur-sm duration-300 animate-in fade-in dark:border-border/20 dark:bg-card/30 dark:shadow-md sm:p-4"
	>
		<Card.Header class="py-6 text-center">
			<div
				class="mx-auto mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 p-3 shadow-sm ring-2 ring-border/20 dark:bg-primary/20 dark:ring-border/10"
			>
				<UserRound size="32" class="text-primary" />
			</div>
			<Card.Title class="mb-2 text-3xl font-semibold text-foreground dark:text-foreground"
				>Welcome back!
			</Card.Title>
			<Card.Description class="text-2xl font-medium text-primary dark:text-primary">
				{$session?.data.user.username}
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col items-center gap-6 px-4 pb-8 sm:px-8">
			<div class="flex w-full max-w-sm flex-col gap-3">
				<Button
					href={ROUTES.DASHBOARD}
					class="w-full transition-all hover:shadow-md dark:hover:shadow-lg"
					size="lg"
				>
					<LayoutDashboard />
					<span class="text-base sm:text-lg">Go to Dashboard</span>
				</Button>
				<Button
					type="button"
					onclick={() =>
						authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									// push route to home
									goto(resolve(ROUTES.HOME as Pathname));
								},
							},
						})}
					class="mt-2 w-full transition-all hover:bg-destructive/10 dark:hover:bg-destructive/20"
					variant="outline"
					size="lg"
				>
					<LogOut class="text-base text-destructive dark:text-destructive" />
					<span class="text-base text-destructive dark:text-destructive sm:text-lg">Sign out</span>
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
{/if}

{#if !$session.data}
	<Card.Root class="mx-auto max-w-sm">
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title class="text-2xl">Login</Card.Title>
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
			<Card.Description>Enter your email below to login to your account</Card.Description>
		</Card.Header>
		<Card.Content>
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
						<div class="flex items-center">
							<label for="password">Password</label>
						</div>
						<Input
							id="password"
							name="password"
							type="password"
							class={errors.password ? 'border-red-500' : ''}
							onchange={() => handleInput('password')}
							required
						/>
						{#if errors.password}
							<p class="text-sm text-red-500">{errors.password}</p>
						{/if}
					</div>
					<a href="##" class="ml-auto inline-block text-sm underline">Forgot your password?</a>
					<Button type="submit" class="w-full" disabled={isLoading}>Login</Button>
					{#if errors.form}
						<p class="mt-2 text-center text-sm text-red-500">{errors.form}</p>
					{/if}
					<!-- <Button variant="outline" class="w-full">Login with Google</Button> -->
				</div>
				<div class="mt-4 text-center text-sm">
					Don&apos;t have an account?
					<a href={resolve(ROUTES.AUTH.SIGNUP as Pathname)} class="underline">Sign up</a>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
{/if}
