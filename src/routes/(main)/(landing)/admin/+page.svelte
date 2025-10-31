<script lang="ts">
	import {
		Activity,
		ChartColumn,
		CircleUser,
		Clock,
		Database,
		Eye,
		FileText,
		Info,
		RefreshCw,
		Star,
		Users,
	} from '@lucide/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import LanguageUsage from '$lib/components/analytics/LanguageUsage.svelte';
	import VisibilityBreakdown from '$lib/components/analytics/VisibilityBreakdown.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger,
	} from '$lib/components/ui/tooltip';
	import { formatUptime, getPublicSiteName } from '$src/lib/utils/format';
	import type { PageData } from './$types';
	import { triggerBackup } from './backup.remote';

	let { data }: { data: PageData } = $props();

	const formatVisibility = (visibility: string) => {
		return visibility
			.toLowerCase()
			.replace('_', ' ')
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	};

	const getVisibilityBadgeVariant = (visibility: string) => {
		switch (visibility) {
			case 'PUBLIC':
				return 'default';
			case 'AUTHENTICATED':
				return 'secondary';
			case 'INVITE_ONLY':
				return 'outline';
			case 'PRIVATE':
				return 'destructive';
			default:
				return 'default';
		}
	};

	// client-side uptime tracking
	let uptimeMs = $state(data.uptime?.milliseconds ?? 0);
	let displayedUptime = $derived(formatUptime(uptimeMs));
	let intervalId = $state<number | null>(null);

	// backup state
	let isBackingUp = $state(false);
	let isRefreshingStats = $state(false);

	const triggerManualBackup = async () => {
		if (isBackingUp) return;

		isBackingUp = true;
		const toastId = toast.loading('Starting database backup...');

		try {
			await triggerBackup();

			toast.success('Database backup completed successfully!', { id: toastId });
			// refresh page data to update last backup timestamp
			await invalidateAll();
		} catch (error) {
			console.error('Backup failed:', error);
			toast.error(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
				id: toastId,
			});
		} finally {
			isBackingUp = false;
		}
	};

	onMount(async () => {
		if (browser) {
			// a bit hacky, but it forces a refresh on load, (fixes bug where if you hover dashboard link, it prefetches, and then the data is out-of-sync)
			await invalidateAll();
			// initialize with server-provided uptime
			uptimeMs = data.uptime?.milliseconds ?? 0;

			// update every second
			intervalId = window.setInterval(() => {
				uptimeMs += 1000;
			}, 1000);
		}
	});

	// clean up on component unmount
	onDestroy(() => {
		if (intervalId !== null) {
			window.clearInterval(intervalId);
			intervalId = null;
		}
	});
</script>

<svelte:head>
	<title>Admin Dashboard - {getPublicSiteName()}</title>
</svelte:head>

<TooltipProvider delayDuration={250}>
	<div class="container mx-auto px-4">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-bold text-foreground">Admin Dashboard</h1>
			<form
				method="POST"
				action="?/refreshStats"
				use:enhance={() => {
					isRefreshingStats = true;
					const toastId = toast.loading('Refreshing statistics...');

					return async ({ update }) => {
						await update();
						isRefreshingStats = false;
						toast.success('Statistics refreshed successfully!', { id: toastId });
					};
				}}
			>
				<Button
					type="submit"
					disabled={isRefreshingStats}
					variant="outline"
					size="sm"
					class="gap-2"
				>
					<RefreshCw class={`h-4 w-4 ${isRefreshingStats ? 'animate-spin' : ''}`} />
					{isRefreshingStats ? 'Refreshing...' : 'Refresh Stats'}
				</Button>
			</form>
		</div>

		<div class="space-y-6">
			<!-- System Stats Grid -->
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<!-- Server Uptime Card -->
				<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-purple-100 p-2 dark:bg-purple-500/20">
							<Clock class="h-5 w-5 text-purple-500" />
						</div>
						<h3 class="text-sm font-medium text-muted-foreground">Server Uptime</h3>
					</div>
					<div class="mt-3 md:mt-6">
						<p class="text-2xl font-bold text-foreground md:text-4xl">{displayedUptime}</p>
						<p class="mt-1 text-xs text-muted-foreground md:mt-2 md:text-sm">Time running</p>
					</div>
				</div>

				<!-- User Stats Card -->
				<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-blue-100 p-2 dark:bg-blue-500/20">
							<Users class="h-5 w-5 text-blue-500" />
						</div>
						<h3 class="text-sm font-medium text-muted-foreground">Total Users</h3>
					</div>
					<div class="mt-3 md:mt-6">
						<p class="text-2xl font-bold text-foreground md:text-4xl">
							+{data.userStats.totalUsers}
						</p>
						<p class="mt-1 text-xs text-muted-foreground md:mt-2 md:text-sm">Active users</p>
					</div>
				</div>

				<!-- Session Stats Card -->
				<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
					<div class="flex items-center gap-2">
						<div class="flex items-center gap-3">
							<div class="rounded-full bg-cyan-100 p-2 dark:bg-cyan-500/20">
								<CircleUser class="h-5 w-5 text-cyan-500" />
							</div>
							<h3 class="text-sm font-medium text-muted-foreground">Sessions</h3>
						</div>
						<Tooltip>
							<TooltipTrigger>
								<Info class="h-4 w-4 text-muted-foreground" />
							</TooltipTrigger>
							<TooltipContent>
								<p class="text-sm text-foreground">
									Sessions are defined as valid session tokens that haven't expired.
								</p>
							</TooltipContent>
						</Tooltip>
					</div>
					<div class="mt-3 md:mt-6">
						<p class="text-2xl font-bold text-foreground md:text-4xl">
							+{data.sessionStats.totalSessions}
						</p>
						<p class="mt-1 text-xs text-muted-foreground md:mt-2 md:text-sm">Valid sessions</p>
					</div>
				</div>

				<!-- Database Backup Card -->
				<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="rounded-full bg-green-100 p-2 dark:bg-green-500/20">
								<Database class="h-5 w-5 text-green-500" />
							</div>
							<div class="flex items-center">
								<h3 class="text-sm font-medium text-muted-foreground">Database Backup</h3>
								{#if !data.filesystemBackupEnabled && !data.s3BackupEnabled && !data.r2BackupEnabled}
									<Tooltip>
										<TooltipTrigger>
											<Info class="ml-2 h-4 w-4 text-yellow-600 dark:text-yellow-500" />
										</TooltipTrigger>
										<TooltipContent>
											<p class="text-sm text-foreground">
												All backups are disabled. Enable them in the settings to create backups.
											</p>
										</TooltipContent>
									</Tooltip>
								{/if}
							</div>
						</div>
					</div>
					<div class="mt-4 flex flex-col items-center">
						{#if data.lastBackup}
							<div class="mb-3 w-64 max-w-sm rounded-lg bg-muted/50 p-3">
								<p class="text-xs font-medium text-muted-foreground">Last Backup</p>
								<p class="mt-1 text-sm font-semibold">
									{new Date(data.lastBackup).toLocaleDateString()} at
									<span class="text-xs font-normal text-muted-foreground">
										{new Date(data.lastBackup).toLocaleTimeString()}
									</span>
								</p>
							</div>
						{:else}
							<div
								class="mb-3 w-64 max-w-sm rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-3"
							>
								<p class="text-xs font-medium text-muted-foreground">No backups yet</p>
								<p class="mt-1 text-xs text-muted-foreground">Create your first backup below</p>
							</div>
						{/if}

						<button
							onclick={triggerManualBackup}
							disabled={isBackingUp ||
								(!data.filesystemBackupEnabled && !data.s3BackupEnabled && !data.r2BackupEnabled)}
							class="w-64 max-w-sm rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
						>
							{#if isBackingUp}
								<span class="flex items-center justify-center gap-2">
									<Database class="h-4 w-4 animate-pulse" />
									Backing up...
								</span>
							{:else}
								Create Backup Now
							{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Paste Statistics Section -->
			{#if data.pasteStats}
				<!-- Core Paste Statistics Cards -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
					<!-- Total Pastes Card -->
					<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
						<div class="flex items-center gap-3">
							<div class="rounded-full bg-purple-100 p-2 dark:bg-purple-500/20">
								<FileText class="h-5 w-5 text-purple-500" />
							</div>
							<h3 class="text-sm font-medium text-muted-foreground">Pastes Created</h3>
						</div>
						<div class="mt-3">
							<div class="mt-2 grid grid-cols-3 gap-2">
								<div class="rounded-lg bg-blue-50 p-2 dark:bg-blue-500/10">
									<p class="text-xs font-medium text-blue-600 dark:text-blue-400">Total</p>
									<p class="text-sm font-bold text-blue-700 dark:text-blue-300">
										{data.pasteStats.totalPastes.toLocaleString()}
									</p>
								</div>
								<div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-500/10">
									<p class="text-xs font-medium text-gray-600 dark:text-gray-400">Authed</p>
									<p class="text-sm font-bold text-gray-700 dark:text-gray-300">
										{data.pasteStats.authedPastes.toLocaleString()}
									</p>
								</div>
								<div class="rounded-lg bg-gray-50 p-2 dark:bg-gray-500/10">
									<p class="text-xs font-medium text-gray-600 dark:text-gray-400">Unauthed</p>
									<p class="text-sm font-bold text-gray-700 dark:text-gray-300">
										{data.pasteStats.unauthedPastes.toLocaleString()}
									</p>
								</div>
							</div>
						</div>
					</div>

					<!-- Total Views Card -->
					<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
						<div class="flex items-center gap-3">
							<div class="rounded-full bg-green-100 p-2 dark:bg-green-500/20">
								<Eye class="h-5 w-5 text-green-500" />
							</div>
							<h3 class="text-sm font-medium text-muted-foreground">Total Views</h3>
						</div>
						<div class="mt-3">
							<p class="text-2xl font-bold text-foreground">
								+{data.pasteStats.totalViews.toLocaleString()}
							</p>
							<p class="mt-1 text-xs text-muted-foreground">All time</p>
						</div>
					</div>

					<!-- Unique Views Card -->
					<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
						<div class="flex items-center gap-3">
							<div class="rounded-full bg-blue-100 p-2 dark:bg-blue-500/20">
								<Users class="h-5 w-5 text-blue-500" />
							</div>
							<h3 class="text-sm font-medium text-muted-foreground">Unique Views</h3>
						</div>
						<div class="mt-3">
							<p class="text-2xl font-bold text-foreground">
								+{data.pasteStats.totalUniqueViews.toLocaleString()}
							</p>
							<p class="mt-1 text-xs text-muted-foreground">Unique viewers</p>
						</div>
					</div>

					<!-- Average Views Card -->
					<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
						<div class="flex items-center gap-3">
							<div class="rounded-full bg-orange-100 p-2 dark:bg-orange-500/20">
								<ChartColumn class="h-5 w-5 text-orange-500" />
							</div>
							<h3 class="text-sm font-medium text-muted-foreground">Avg. Views</h3>
						</div>
						<div class="mt-3">
							<p class="text-2xl font-bold text-foreground">
								~{data.pasteStats.averageViewsPerPaste}
							</p>
							<p class="mt-1 text-xs text-muted-foreground">Per paste</p>
						</div>
					</div>
				</div>

				<!-- Main Analytics Cards -->
				<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					<!-- Visibility Breakdown -->
					<VisibilityBreakdown
						publicCount={data.pasteStats.visibilityBreakdown.PUBLIC}
						authenticatedCount={data.pasteStats.visibilityBreakdown.AUTHENTICATED}
						inviteOnlyCount={data.pasteStats.visibilityBreakdown.INVITE_ONLY}
						privateCount={data.pasteStats.visibilityBreakdown.PRIVATE}
						totalCount={data.pasteStats.totalPastes}
					/>

					<!-- Most Viewed Paste -->
					<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
						<div class="mb-4 flex items-center gap-3">
							<div class="rounded-full bg-yellow-100 p-2 dark:bg-yellow-500/20">
								<Star class="h-5 w-5 text-yellow-500" />
							</div>
							<h3 class="text-lg font-semibold">Most Viewed Paste</h3>
						</div>
						{#if data.pasteStats.mostViewedPaste}
							<div class="space-y-3">
								<div>
									<div class="flex items-center gap-2">
										<p class="font-medium">
											{data.pasteStats.mostViewedPaste.title ||
												`Paste ${data.pasteStats.mostViewedPaste.id}`}
										</p>
										<Badge
											variant={getVisibilityBadgeVariant(
												data.pasteStats.mostViewedPaste.visibility
											)}
											class="text-xs"
										>
											{formatVisibility(data.pasteStats.mostViewedPaste.visibility)}
										</Badge>
									</div>
									<p class="text-sm text-muted-foreground">
										By @{data.pasteStats.mostViewedPaste.ownerUsername}
									</p>
								</div>
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<Eye class="h-4 w-4 text-blue-500" />
										<span class="text-2xl font-bold">
											{data.pasteStats.mostViewedPaste.views.toLocaleString()}
										</span>
										<span class="text-sm text-muted-foreground">views</span>
									</div>
									<Button
										href="/{data.pasteStats.mostViewedPaste.customSlug ||
											data.pasteStats.mostViewedPaste.id}"
										variant="outline"
										size="sm"
									>
										View Paste
									</Button>
								</div>
							</div>
						{:else}
							<div class="flex items-center justify-center py-8 text-muted-foreground">
								<p>No pastes found</p>
							</div>
						{/if}
					</div>

					<!-- Language Usage -->
					<LanguageUsage
						languageDistribution={data.pasteStats.languageDistribution}
						totalCount={data.pasteStats.totalPastes}
					/>
				</div>

				<!-- Additional Metrics Section -->
				<div class="grid gap-6 md:grid-cols-2">
					<!-- Most Active Users -->
					<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
						<div class="mb-4 flex items-center gap-3">
							<div class="rounded-full bg-cyan-100 p-2 dark:bg-cyan-500/20">
								<Users class="h-5 w-5 text-cyan-500" />
							</div>
							<h3 class="text-lg font-semibold">Most Active Users</h3>
						</div>
						{#if data.pasteStats.mostActiveUsers.length > 0}
							<div class="space-y-2">
								{#each data.pasteStats.mostActiveUsers as activeUser (activeUser.userId)}
									<div
										class="flex items-center justify-between rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/50"
									>
										<div class="flex items-center gap-2">
											<div class="rounded-full bg-blue-100 p-1.5 dark:bg-blue-500/20">
												<Users class="h-3 w-3 text-blue-500" />
											</div>
											<span class="font-medium">
												@{activeUser.displayUsername || activeUser.username}
											</span>
										</div>
										<span class="text-sm font-semibold text-muted-foreground">
											{activeUser.pasteCount} paste{activeUser.pasteCount !== 1 ? 's' : ''}
										</span>
									</div>
								{/each}
							</div>
						{:else}
							<div class="flex items-center justify-center py-4 text-muted-foreground">
								<p>No active users</p>
							</div>
						{/if}
					</div>

					<!-- Recent Paste Activity -->
					<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
						<div class="mb-4 flex items-center gap-3">
							<div class="rounded-full bg-pink-100 p-2 dark:bg-pink-500/20">
								<Activity class="h-5 w-5 text-pink-500" />
							</div>
							<h3 class="text-lg font-semibold">Recent Activity (Paste Creation)</h3>
						</div>
						<div class="space-y-3">
							<div
								class="flex items-center justify-between rounded-lg border border-border bg-background p-3"
							>
								<span class="text-sm font-medium text-muted-foreground">Last 24 hours</span>
								<span class="text-lg font-bold">+{data.pasteStats.recentActivity.last24h}</span>
							</div>
							<div
								class="flex items-center justify-between rounded-lg border border-border bg-background p-3"
							>
								<span class="text-sm font-medium text-muted-foreground">Last 7 days</span>
								<span class="text-lg font-bold">+{data.pasteStats.recentActivity.last7d}</span>
							</div>
							<div
								class="flex items-center justify-between rounded-lg border border-border bg-background p-3"
							>
								<span class="text-sm font-medium text-muted-foreground">Last 30 days</span>
								<span class="text-lg font-bold">+{data.pasteStats.recentActivity.last30d}</span>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</TooltipProvider>
