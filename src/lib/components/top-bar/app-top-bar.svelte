<script lang="ts">
	import type { DBUser } from '$database/schema';
	import {
		FileText,
		House,
		LayoutDashboard,
		Menu,
		PanelsTopLeft,
		Settings,
		SquareUser,
		UsersIcon,
		X,
	} from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { type Pathname } from '$app/types';
	import { ROUTES } from '$src/lib/routes';
	import { getPublicSiteName } from '$src/lib/utils/format';
	import ThemeToggle from '$components/theme-toggle.svelte';
	import NavUserDropdown from './nav-user-dropdown.svelte';

	let {
		isAdmin,
		user,
	}: {
		isAdmin: boolean;
		user: DBUser | null;
	} = $props();

	let isMobileMenuOpen = $state(false);

	const toggleMobileMenu = () => {
		isMobileMenuOpen = !isMobileMenuOpen;
	};

	const closeMobileMenu = () => {
		isMobileMenuOpen = false;
	};

	// only show these navigation items for logged-in users
	const dashboardNavItems = user
		? [
				{
					url: ROUTES.DASHBOARD,
					label: 'Dashboard',
					icon: LayoutDashboard,
				},
			]
		: [];

	const settingsNavItems = user
		? [
				{
					url: ROUTES.PROFILE,
					label: 'Profile',
					icon: SquareUser,
				},
			]
		: [];

	const adminNavItems = [
		{
			url: ROUTES.ADMIN.BASE,
			label: 'Admin Dashboard',
			icon: PanelsTopLeft,
		},
		{
			url: ROUTES.ADMIN.USERS.BASE,
			label: 'User Management',
			icon: UsersIcon,
		},
		{
			url: ROUTES.ADMIN.PASTES,
			label: 'Paste Management',
			icon: FileText,
		},
		{
			url: ROUTES.ADMIN.SETTINGS,
			label: 'Settings',
			icon: Settings,
		},
	];

	const isCurrentPath = (path: string) => {
		return page.url.pathname === path;
	};
</script>

<header
	class="fixed left-0 right-0 top-0 z-50 flex h-[var(--navbar-height)] items-center gap-2 border-border bg-background px-4 py-2"
>
	<!-- Logo/Brand -->
	<a
		href={resolve(ROUTES.HOME as Pathname)}
		class="flex items-center gap-2 text-foreground transition-colors hover:text-primary"
		title={getPublicSiteName()}
	>
		<enhanced:img
			src="/static/favicon.png"
			alt={getPublicSiteName()}
			class="h-6 w-6 transition-all duration-200 hover:saturate-200 [&:not([src])]:w-auto [&:not([src])]:px-1"
		/>
	</a>

	<!-- Mobile Hamburger Menu Button (visible only on xs screens) -->
	<button
		onclick={toggleMobileMenu}
		class="ml-auto rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary xs:hidden"
		title="Menu"
		aria-label="Toggle menu"
	>
		<Menu class="h-5 w-5" />
	</button>

	<!-- Desktop Navigation (hidden on xs screens) -->
	<nav class="hidden items-center gap-1 xs:flex">
		<!-- Dashboard Section (only for logged-in users) -->
		{#if user}
			{#each dashboardNavItems as item (item.url)}
				<a
					href={resolve(item.url as Pathname)}
					class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary {isCurrentPath(
						item.url
					)
						? 'bg-accent text-primary'
						: ''}"
					title={item.label}
				>
					<item.icon class="h-5 w-5" />
				</a>
			{/each}

			<!-- Separator -->
			<div class="mx-2 h-6 w-px bg-border"></div>

			<!-- Settings Section -->
			{#each settingsNavItems as item (item.url)}
				<a
					href={resolve(item.url as Pathname)}
					class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary {isCurrentPath(
						item.url
					)
						? 'bg-accent text-primary'
						: ''}"
					title={item.label}
				>
					<item.icon class="h-5 w-5" />
				</a>
			{/each}
		{/if}

		<!-- Admin Section -->
		{#if isAdmin && user}
			<!-- Separator -->
			<div class="mx-2 h-6 w-px bg-border"></div>

			{#each adminNavItems as item (item.url)}
				<a
					href={resolve(item.url as Pathname)}
					class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary {isCurrentPath(
						item.url
					)
						? 'bg-accent text-primary'
						: ''}"
					title={item.label}
				>
					<item.icon class="h-5 w-5" />
				</a>
			{/each}
		{/if}
	</nav>

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Right Side Controls (hidden on xs screens) -->
	<div class="hidden items-center gap-2 xs:flex">
		<ThemeToggle />
		<NavUserDropdown user={(user as DBUser) || null} />
	</div>
</header>

<!-- Mobile Drawer Overlay (visible only on xs screens) -->
{#if isMobileMenuOpen}
	<!-- Backdrop -->
	<button
		transition:fade={{ duration: 200 }}
		onclick={closeMobileMenu}
		class="fixed inset-0 z-40 bg-black/50 xs:hidden"
		aria-label="Close menu"
	></button>

	<!-- Drawer -->
	<div
		transition:fly={{ x: -256, duration: 300 }}
		class="fixed inset-y-0 left-0 z-50 w-64 bg-background shadow-lg xs:hidden"
		style="top: var(--navbar-height);"
	>
		<div class="flex h-full flex-col overflow-y-auto">
			<!-- Close Button -->
			<div class="flex items-center justify-end border-b border-border px-3 py-2">
				<button
					onclick={closeMobileMenu}
					class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					aria-label="Close menu"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Navigation Items -->
			<nav class="flex flex-col gap-1 p-2">
				<!-- Home Button -->
				<a
					href={resolve(ROUTES.HOME as Pathname)}
					onclick={closeMobileMenu}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-primary {isCurrentPath(
						ROUTES.HOME
					)
						? 'bg-accent text-primary'
						: ''}"
				>
					<House class="h-5 w-5" />
					<span>Home</span>
				</a>

				{#if user}
					<!-- Separator -->
					<div class="mx-3 mb-2 h-px bg-border"></div>
				{/if}

				<!-- Dashboard Section (only for logged-in users) -->
				{#if user}
					<div class="mb-1">
						<div class="my-1 px-3 text-xs font-semibold uppercase text-muted-foreground">
							Dashboard
						</div>
						{#each dashboardNavItems as item (item.url)}
							<a
								href={resolve(item.url as Pathname)}
								onclick={closeMobileMenu}
								class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-primary {isCurrentPath(
									item.url
								)
									? 'bg-accent text-primary'
									: ''}"
							>
								<item.icon class="h-5 w-5" />
								<span>{item.label}</span>
							</a>
						{/each}
					</div>

					<!-- Separator -->
					<div class="mx-3 mb-2 h-px bg-border"></div>

					<!-- Settings Section -->
					<div>
						<div class="mb-1 px-3 text-xs font-semibold uppercase text-muted-foreground">
							Settings
						</div>
						{#each settingsNavItems as item (item.url)}
							<a
								href={resolve(item.url as Pathname)}
								onclick={closeMobileMenu}
								class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-primary {isCurrentPath(
									item.url
								)
									? 'bg-accent text-primary'
									: ''}"
							>
								<item.icon class="h-5 w-5" />
								<span>{item.label}</span>
							</a>
						{/each}
					</div>
				{/if}

				<!-- Admin Section -->
				{#if isAdmin && user}
					<!-- Separator -->
					<div class="mx-3 mb-2 h-px bg-border"></div>

					<div>
						<div class="mb-1 px-3 text-xs font-semibold uppercase text-muted-foreground">Admin</div>
						{#each adminNavItems as item (item.url)}
							<a
								href={resolve(item.url as Pathname)}
								onclick={closeMobileMenu}
								class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-primary {isCurrentPath(
									item.url
								)
									? 'bg-accent text-primary'
									: ''}"
							>
								<item.icon class="h-5 w-5" />
								<span>{item.label}</span>
							</a>
						{/each}
					</div>
				{/if}
			</nav>

			<!-- Bottom Controls -->
			<div class="mt-auto border-t border-border p-4">
				<div class="mb-3 flex items-center justify-between">
					<span class="text-xs font-semibold uppercase text-muted-foreground">Theme</span>
					<ThemeToggle />
				</div>
				<NavUserDropdown
					user={(user as DBUser) || null}
					showFullInfo
					onItemClick={closeMobileMenu}
				/>
			</div>
		</div>
	</div>
{/if}
