<script lang="ts">
	import type { DBUser } from '$database/schema';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import LogIn from '@lucide/svelte/icons/log-in';
	import LogOut from '@lucide/svelte/icons/log-out';
	import User from '@lucide/svelte/icons/user';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { authClient } from '$lib/auth-client';
	import { ROUTES } from '$src/lib/routes';
	import {
		formatEmail,
		formatEmailFromUserObject,
		formatUserName,
		formatUserNameInitials,
		isUnauthenticatedUser,
	} from '$src/lib/utils/format';
	import * as Avatar from '$components/ui/avatar/index.js';
	import * as DropdownMenu from '$components/ui/dropdown-menu/index.js';

	let {
		user,
		showFullInfo = false,
		onItemClick,
	}: {
		user: DBUser | null;
		showFullInfo?: boolean;
		onItemClick?: () => void;
	} = $props();

	const handleLogout = async () => {
		onItemClick?.();
		await authClient.signOut();
		goto(resolve(ROUTES.AUTH.SIGNIN as Pathname));
	};

	const handleSignIn = () => {
		onItemClick?.();
		goto(resolve(ROUTES.AUTH.SIGNIN as Pathname));
	};

	const handleAccountClick = () => {
		onItemClick?.();
		goto(resolve(ROUTES.PROFILE as Pathname));
	};

	const userName = user ? formatUserName(user) : 'Guest';
	const userInitials = user ? formatUserNameInitials(user) : 'G';
	const userEmail = user ? formatEmailFromUserObject(user) : null;

	// Check if user is unauthenticated
	const isUnauthenticated = $derived(isUnauthenticatedUser(user));
</script>

{#if isUnauthenticated}
	<!-- Simple sign-in button for unauthenticated users -->
	<button
		onclick={handleSignIn}
		class="flex items-center gap-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary {showFullInfo
			? 'w-full justify-start'
			: ''}"
		title="Sign in"
	>
		<LogIn class="h-5 w-5" />
		{#if showFullInfo}
			<span class="text-sm font-medium text-foreground">Sign In</span>
		{/if}
	</button>
{:else}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					class="flex items-center gap-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary {showFullInfo
						? 'w-full justify-start'
						: ''}"
					title={user ? userName : 'Sign in'}
				>
					{#if user}
						<Avatar.Root class="h-6 w-6 flex-shrink-0 rounded-lg">
							<Avatar.Image src="" alt={userName} />
							<Avatar.Fallback class="rounded-lg text-xs">{userInitials}</Avatar.Fallback>
						</Avatar.Root>
						{#if showFullInfo}
							<div class="flex flex-1 flex-col items-start text-left">
								<span class="text-sm font-medium text-foreground">{userName}</span>
								{#if userEmail}
									<span class="text-xs text-muted-foreground">{formatEmail(userEmail)}</span>
								{/if}
							</div>
						{/if}
					{:else}
						<User class="h-5 w-5" />
						{#if showFullInfo}
							<span class="text-sm font-medium text-foreground">Sign In</span>
						{/if}
					{/if}
					<ChevronDown class="h-3 w-3 {showFullInfo ? 'ml-auto' : ''}" />
				</button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content class="w-56" align="end" sideOffset={4}>
			{#if user}
				<!-- Logged-in user dropdown -->
				<DropdownMenu.Label class="p-0 font-normal">
					<div class="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
						<Avatar.Root class="h-8 w-8 rounded-lg">
							<Avatar.Image src="" alt={userName} />
							<Avatar.Fallback class="rounded-lg">{userInitials}</Avatar.Fallback>
						</Avatar.Root>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-semibold">{userName}</span>
							{#if userEmail}
								<span class="truncate text-xs">{formatEmail(userEmail)}</span>
							{/if}
						</div>
					</div>
				</DropdownMenu.Label>

				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item onclick={handleAccountClick}>
						<BadgeCheck class="mr-2 h-4 w-4" />
						<a href={resolve(ROUTES.PROFILE as Pathname)}>Account</a>
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item onclick={handleLogout}>
						<LogOut class="mr-2 h-4 w-4" />
						Sign out
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			{:else}
				<!-- Non-logged-in user dropdown -->
				<DropdownMenu.Label class="px-2 py-1.5 text-sm font-semibold">Welcome!</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onclick={handleSignIn}>
					<LogIn class="mr-2 h-4 w-4" />
					Sign In
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
