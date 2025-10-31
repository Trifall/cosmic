<script lang="ts">
	import type { DBUser } from '$database/schema';
	import { getLanguageDisplayName } from '@/src/lib/shared/languages';
	import {
		Activity,
		Calendar,
		ChartColumn,
		Code,
		Eye,
		FileText,
		Globe,
		Lock,
		Shield,
		Star,
		TrendingUp,
		User,
		Users,
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import type { IndividualUserStatistics } from '$src/lib/server/users';
	import {
		capitalizeFirstLetter,
		formatEmail,
		formatFormalDate,
		formatRelativeTime,
		formatUserName,
	} from '$src/lib/utils/format';

	type Props = {
		user: DBUser;
		statistics: IndividualUserStatistics;
		error?: string | null;
	};

	let { user, statistics, error = null }: Props = $props();

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

	const getViewUrl = (
		paste:
			| IndividualUserStatistics['mostViewedPaste']
			| IndividualUserStatistics['recentPastes'][number]
	): Pathname => {
		return `/${(paste?.customSlug || paste?.id) ?? ''}`;
	};

	// format account age display
	const formatAccountAge = (accountAge: { days: number; months: number; years: number }) => {
		if (accountAge.years > 0) {
			return `${accountAge.years} year${accountAge.years > 1 ? 's' : ''}`;
		}
		if (accountAge.months > 0) {
			return `${accountAge.months} month${accountAge.months > 1 ? 's' : ''}`;
		}
		return `${accountAge.days} day${accountAge.days > 1 ? 's' : ''}`;
	};
</script>

<div class="min-w-full space-y-6">
	{#if error}
		<div class="mb-4 rounded-md bg-destructive/15 p-4 text-destructive">
			<p>{error}</p>
		</div>
	{/if}

	{#if !user}
		<div class="mb-4 rounded-md bg-destructive/15 p-4 text-destructive">
			<p>User not found</p>
		</div>
	{:else}
		<!-- User Basic Info Card -->
		<div class="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900/90">
			<div class="flex items-start gap-4">
				<div class="rounded-full bg-blue-100 p-3 dark:bg-blue-500/20">
					<User class="h-8 w-8 text-blue-500" />
				</div>
				<div class="flex-1">
					<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
						<div>
							<h2 class="text-xl font-bold text-slate-900 dark:text-white">
								{formatUserName(user)}
							</h2>
							<p class="text-sm text-muted-foreground">{formatEmail(user.email)}</p>
						</div>
						<div class="flex flex-wrap gap-2">
							<Badge variant={user.banned ? 'destructive' : 'default'}>
								{user.banned ? 'Banned' : capitalizeFirstLetter(user.role)}
							</Badge>
							{#if user.emailVerified}
								<Badge variant="secondary">Verified</Badge>
							{/if}
						</div>
					</div>
					<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							<Calendar class="h-4 w-4" />
							<span>Joined {formatFormalDate(user.createdAt)}</span>
						</div>
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							<Activity class="h-4 w-4" />
							<span>Account age: {formatAccountAge(statistics.accountAge)}</span>
						</div>
						{#if statistics.lastActivity}
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<TrendingUp class="h-4 w-4" />
								<span>Last activity: {formatRelativeTime(statistics.lastActivity)}</span>
							</div>
						{/if}
					</div>
					{#if user.banned && user.banReason}
						<div class="mt-4 rounded-md bg-destructive/15 p-3">
							<p class="text-sm text-destructive">
								<strong>Ban Reason:</strong>
								{user.banReason}
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Statistics Overview Cards -->
		<div class="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
			<!-- Total Pastes Card -->
			<div class="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900/90">
				<div
					class="flex items-center justify-center lg:justify-between xl:flex-col xl:justify-center xl:gap-2"
				>
					<div class="rounded-full bg-purple-100 p-2 dark:bg-purple-500/20">
						<FileText class="h-5 w-5 text-purple-500" />
					</div>
					<TrendingUp class="hidden h-4 w-4 text-muted-foreground lg:block xl:hidden" />
				</div>
				<div class="mt-4 text-center">
					<p class="text-3xl font-bold text-slate-900 dark:text-white lg:text-2xl xl:text-2xl">
						{statistics.totalPastes}
					</p>
					<p class="text-sm text-muted-foreground lg:text-xs">Total Pastes</p>
				</div>
			</div>

			<!-- Total Views Card -->
			<div class="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900/90">
				<div
					class="flex items-center justify-center lg:justify-between xl:flex-col xl:justify-center xl:gap-2"
				>
					<div class="rounded-full bg-green-100 p-2 dark:bg-green-500/20">
						<Eye class="h-5 w-5 text-green-500" />
					</div>
					<ChartColumn class="hidden h-4 w-4 text-muted-foreground lg:block xl:hidden" />
				</div>
				<div class="mt-4 text-center">
					<p class="text-3xl font-bold text-slate-900 dark:text-white lg:text-2xl xl:text-2xl">
						{statistics.totalViews.toLocaleString()}
					</p>
					<p class="text-sm text-muted-foreground lg:text-xs">Total Views</p>
				</div>
			</div>

			<!-- Average Views Card -->
			<div class="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900/90">
				<div
					class="flex items-center justify-center lg:justify-between xl:flex-col xl:justify-center xl:gap-2"
				>
					<div class="rounded-full bg-orange-100 p-2 dark:bg-orange-500/20">
						<ChartColumn class="h-5 w-5 text-orange-500" />
					</div>
					<TrendingUp class="hidden h-4 w-4 text-muted-foreground lg:block xl:hidden" />
				</div>
				<div class="mt-4 text-center">
					<p class="text-3xl font-bold text-slate-900 dark:text-white lg:text-2xl xl:text-2xl">
						~{statistics.averageViewsPerPaste}
					</p>
					<p class="text-sm text-muted-foreground lg:text-xs">Avg. Views per Paste</p>
				</div>
			</div>

			<!-- Unique Views Card -->
			<div class="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900/90">
				<div
					class="flex items-center justify-center lg:justify-between xl:flex-col xl:justify-center xl:gap-2"
				>
					<div class="rounded-full bg-blue-100 p-2 dark:bg-blue-500/20">
						<Users class="h-5 w-5 text-blue-500" />
					</div>
					<Eye class="hidden h-4 w-4 text-muted-foreground lg:block xl:hidden" />
				</div>
				<div class="mt-4 text-center">
					<p class="text-3xl font-bold text-slate-900 dark:text-white lg:text-2xl xl:text-2xl">
						{statistics.totalUniqueViews.toLocaleString()}
					</p>
					<p class="text-sm text-muted-foreground lg:text-xs">Unique Views</p>
				</div>
			</div>
		</div>

		<!-- Main stats cards - 3 columns on 2xl+ screens -->
		<div class="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
			<!-- Paste Visibility Breakdown -->
			<div class="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900/90">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-full bg-indigo-100 p-2 dark:bg-indigo-500/20">
						<Shield class="h-5 w-5 text-indigo-500" />
					</div>
					<h3 class="text-lg font-semibold text-slate-900 dark:text-white">Paste Visibility</h3>
				</div>
				<div class="space-y-3">
					<div class="grid grid-cols-[1fr_auto_auto] items-center">
						<div class="flex items-center gap-2">
							<Globe class="h-4 w-4 text-green-500" />
							<span class="text-sm">Public</span>
						</div>
						<div class="text-right">
							<span class="text-lg font-semibold">{statistics.publicPastes}</span>
						</div>
						<div class="w-10 text-right">
							{#if statistics.totalPastes > 0}
								<span class="text-xs text-muted-foreground">
									({Math.round((statistics.publicPastes / statistics.totalPastes) * 100)}%)
								</span>
							{/if}
						</div>
					</div>
					<div class="grid grid-cols-[1fr_auto_auto] items-center">
						<div class="flex items-center gap-2">
							<Users class="h-4 w-4 text-blue-500" />
							<span class="text-sm">Authenticated</span>
						</div>
						<div class="text-right">
							<span class="text-lg font-semibold">{statistics.authenticatedPastes}</span>
						</div>
						<div class="w-10 text-right">
							{#if statistics.totalPastes > 0}
								<span class="text-xs text-muted-foreground">
									({Math.round((statistics.authenticatedPastes / statistics.totalPastes) * 100)}%)
								</span>
							{/if}
						</div>
					</div>
					<div class="grid grid-cols-[1fr_auto_auto] items-center">
						<div class="flex items-center gap-2">
							<Shield class="h-4 w-4 text-yellow-500" />
							<span class="text-sm">Invite Only</span>
						</div>
						<div class="text-right">
							<span class="text-lg font-semibold">{statistics.inviteOnlyPastes}</span>
						</div>
						<div class="w-10 text-right">
							{#if statistics.totalPastes > 0}
								<span class="text-xs text-muted-foreground">
									({Math.round((statistics.inviteOnlyPastes / statistics.totalPastes) * 100)}%)
								</span>
							{/if}
						</div>
					</div>
					<div class="grid grid-cols-[1fr_auto_auto] items-center">
						<div class="flex items-center gap-2">
							<Lock class="h-4 w-4 text-red-500" />
							<span class="text-sm">Private</span>
						</div>
						<div class="text-right">
							<span class="text-lg font-semibold">{statistics.privatePastes}</span>
						</div>
						<div class="w-10 text-right">
							{#if statistics.totalPastes > 0}
								<span class="text-xs text-muted-foreground">
									({Math.round((statistics.privatePastes / statistics.totalPastes) * 100)}%)
								</span>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Most Viewed Paste -->
			<div class="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900/90">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-full bg-yellow-100 p-2 dark:bg-yellow-500/20">
						<Star class="h-5 w-5 text-yellow-500" />
					</div>
					<h3 class="text-lg font-semibold text-slate-900 dark:text-white">Most Viewed Paste</h3>
				</div>
				{#if statistics.mostViewedPaste}
					<div class="space-y-3">
						<div>
							<div class="flex items-center gap-2">
								<p class="font-medium text-slate-900 dark:text-white">
									{statistics.mostViewedPaste.title || `Paste ${statistics.mostViewedPaste.id}`}
								</p>
								<Badge
									variant={getVisibilityBadgeVariant(statistics.mostViewedPaste.visibility)}
									class="text-xs"
								>
									{capitalizeFirstLetter(
										statistics.mostViewedPaste.visibility.toLowerCase().replace('_', ' ')
									)}
								</Badge>
							</div>
							<p class="text-sm text-muted-foreground">ID: {statistics.mostViewedPaste.id}</p>
						</div>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Eye class="h-4 w-4 text-blue-500" />
								<span class="text-2xl font-bold text-slate-900 dark:text-white">
									{statistics.mostViewedPaste.views}
								</span>
								<span class="text-sm text-muted-foreground">views</span>
							</div>
							<Button
								href={resolve(getViewUrl(statistics.mostViewedPaste)) as Pathname}
								variant="outline"
								size="sm"
							>
								View Paste
							</Button>
						</div>
						<p class="text-xs text-muted-foreground">
							Created {formatRelativeTime(statistics.mostViewedPaste.createdAt)}
						</p>
					</div>
				{:else}
					<div class="flex items-center justify-center py-8 text-muted-foreground">
						<p>No pastes found</p>
					</div>
				{/if}
			</div>

			<!-- Language Distribution -->
			<div class="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900/90">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-full bg-emerald-100 p-2 dark:bg-emerald-500/20">
						<Code class="h-5 w-5 text-emerald-500" />
					</div>
					<h3 class="text-lg font-semibold text-slate-900 dark:text-white">Language Usage</h3>
				</div>
				{#if statistics.languageDistribution.length > 0}
					<div class="h-44 overflow-y-auto rounded border border-border bg-background p-2">
						<div class="space-y-2">
							{#each statistics.languageDistribution as lang (lang.language)}
								<div class="grid grid-cols-[1fr_auto_auto] items-center p-1">
									<span class="text-sm font-medium">
										{getLanguageDisplayName(lang.language)}
										{#if getLanguageDisplayName(lang.language) !== lang.language}
											<span class="text-xs text-muted-foreground">({lang.language})</span>
										{/if}
									</span>
									<div class="text-right">
										<span class="text-sm font-semibold">{lang.count}</span>
									</div>
									<div class="w-10 text-right">
										{#if statistics.totalPastes > 0}
											<span class="text-xs text-muted-foreground">
												({Math.round((lang.count / statistics.totalPastes) * 100)}%)
											</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="flex items-center justify-center py-4 text-muted-foreground">
						<p>No language data available</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Recent Pastes - Constrained width on large screens -->
		<div class="mx-auto w-full max-w-4xl">
			<div class="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900/90">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-full bg-cyan-100 p-2 dark:bg-cyan-500/20">
						<Activity class="h-5 w-5 text-cyan-500" />
					</div>
					<h3 class="text-lg font-semibold text-slate-900 dark:text-white">Recent Pastes</h3>
				</div>
				{#if statistics.recentPastes.length > 0}
					<div class="space-y-3">
						{#each statistics.recentPastes as paste (paste.id)}
							<div
								class="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800"
							>
								<div class="flex-1">
									<div class="flex items-center gap-2">
										<p class="font-medium text-slate-900 dark:text-white">
											{paste.title || `Paste ${paste.id}`}
										</p>
										<Badge variant={getVisibilityBadgeVariant(paste.visibility)} class="text-xs">
											{capitalizeFirstLetter(paste.visibility.toLowerCase().replace('_', ' '))}
										</Badge>
									</div>
									<div class="flex items-center gap-4 text-xs text-muted-foreground">
										<span>{paste.language || 'plaintext'}</span>
										<span>{paste.views} views</span>
										<span>{formatRelativeTime(paste.createdAt)}</span>
									</div>
								</div>
								<Button href={resolve(getViewUrl(paste)) as Pathname} variant="ghost" size="sm"
									>View</Button
								>
							</div>
						{/each}
					</div>
				{:else}
					<div class="flex items-center justify-center py-4 text-muted-foreground">
						<p>No recent pastes</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
