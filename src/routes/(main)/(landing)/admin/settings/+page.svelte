<script lang="ts">
	import type { Settings } from '@/database/schema/system';
	import { Info } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import CronJobInput from '$lib/components/cron/CronJobInput.svelte';
	import {
		type AllSettings,
		EXPIRY_OPTIONS,
		SETTING_DEFAULT_VALUES,
	} from '$src/lib/shared/settings';
	import { getPublicSiteName } from '$src/lib/utils/format';
	import { getAllSettingsQuery } from '$src/routes/(main)/(landing)/admin/settings/settings.remote';
	import { Button } from '$components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$components/ui/select';
	import { Skeleton } from '$components/ui/skeleton';
	import { Switch } from '$components/ui/switch';
	import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '$components/ui/tooltip';

	const getInitialFormState = (): AllSettings => {
		const defaults: Partial<AllSettings> = {};
		const allDefaultSettings = Object.entries(SETTING_DEFAULT_VALUES);

		allDefaultSettings.forEach(([key, value]) => {
			// type assertion to assign to specific keys
			(defaults as any)[key] = value;
		});
		return defaults as AllSettings;
	};

	const INITIAL_FORM_STATE = getInitialFormState();

	// use remote query instead of page data
	const settingsQuery = getAllSettingsQuery();

	let isSubmitting = $state(false);
	let formState = $state<AllSettings>({ ...INITIAL_FORM_STATE });

	const updateFullFormState = (settingsData: Settings[]) => {
		const newFormState = { ...INITIAL_FORM_STATE } satisfies AllSettings;

		if (Array.isArray(settingsData) && settingsData.length > 0) {
			const serverSettingsMap = new Map(settingsData.map((s) => [s.key, s.value]));

			// iterate over the keys of AllSettings
			for (const key of Object.keys(newFormState) as Array<keyof AllSettings>) {
				if (serverSettingsMap.has(key)) {
					const serverValue = serverSettingsMap.get(key);
					// get the type of the default value for THIS key for coercion
					const defaultValueForKey = INITIAL_FORM_STATE[key];

					if (typeof defaultValueForKey === 'number') {
						(newFormState[key] as unknown as number) = Number(serverValue);
					} else if (typeof defaultValueForKey === 'string') {
						// handle different types of string values
						const strValue = String(serverValue);
						// for other string values (like cron expressions), use the server value directly
						(newFormState[key] as unknown as string) = strValue;
					} else if (typeof defaultValueForKey === 'boolean') {
						(newFormState[key] as unknown as boolean) = Boolean(serverValue);
					}
				}
			}
		}

		formState = newFormState;
	};

	// react to query data changes
	$effect(() => {
		const data = settingsQuery.current;
		if (data?.settings) {
			updateFullFormState(data.settings);
		}
	});
</script>

<svelte:head>
	<title>Admin - Settings - {getPublicSiteName()}</title>
</svelte:head>

<TooltipProvider delayDuration={0}>
	<div class="container mx-auto px-4">
		<div class="mx-auto mb-6 flex max-w-4xl items-center justify-between">
			<div class="space-y-1">
				<h1 class="text-3xl font-bold">Admin Settings</h1>
			</div>
		</div>

		<!-- Main Content -->
		<div class="mx-auto max-w-4xl space-y-8">
			<form
				method="POST"
				action="?/updateSettings"
				class="space-y-8"
				use:enhance={() => {
					isSubmitting = true;
					const toastId = toast.loading('Saving settings...');

					return async ({ result }) => {
						toast.dismiss(toastId);

						if (result.type === 'success') {
							if (result.data?.success) {
								toast.success('Settings saved successfully!');
								// refresh the settings query to get updated values
								await settingsQuery.refresh();
							} else {
								toast.success('Settings updated');
								// refresh the settings query to get updated values
								await settingsQuery.refresh();
							}
						} else if (result.type === 'failure') {
							toast.error('Failed to save settings');
						} else if (result.type === 'error') {
							toast.error('An error occurred while saving settings');
						}

						isSubmitting = false;
					};
				}}
			>
				<!-- System Settings Section -->
				<Card class="border-none">
					<CardHeader>
						<div class="flex items-center space-x-2">
							<div class="h-2 w-2 rounded-full bg-blue-500"></div>
							<CardTitle class="text-xl font-semibold">System Settings</CardTitle>
						</div>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<label for="publicRegistrationSwitch" class="text-sm font-semibold">
									Public Registration
								</label>
								<p class="text-sm text-muted-foreground">Allow new users to register.</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="publicRegistration"
										value={formState.publicRegistration ? 'true' : 'false'}
									/>
									<Switch
										id="publicRegistrationSwitch"
										bind:checked={formState.publicRegistration}
										disabled={isSubmitting}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<div class="space-y-3 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<label for="maxPastesPerUser" class="text-sm font-semibold">
									Max Pastes Per User
								</label>
								<p class="text-sm text-muted-foreground">
									Maximum number of pastes a user can create (1-100,000).
								</p>
							</div>
							{#if !settingsQuery.loading}
								<input
									type="number"
									id="maxPastesPerUser"
									name="maxPastesPerUser"
									bind:value={formState.maxPastesPerUser}
									min="1"
									max="10000"
									class="flex h-10 w-32 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									disabled={isSubmitting}
								/>
							{:else}
								<Skeleton class="h-10" />
							{/if}
						</div>

						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<label for="enableFullTextSearchSwitch" class="text-sm font-semibold">
									Enable Full-Text Search
								</label>
								<p class="text-sm text-muted-foreground">
									Enable full-text search across paste content, titles, and descriptions.
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="enableFullTextSearch"
										value={formState.enableFullTextSearch ? 'true' : 'false'}
									/>
									<Switch
										id="enableFullTextSearchSwitch"
										bind:checked={formState.enableFullTextSearch}
										disabled={isSubmitting}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<div class="gap-2 space-y-3 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<div class="flex items-center">
									<label for="searchResultsLimit" class="text-sm font-semibold">
										Search Results Limit
									</label>
									{#if !formState.enableFullTextSearch}
										<Tooltip>
											<TooltipTrigger>
												<Info class="ml-2 h-4 w-4 text-muted-foreground" />
											</TooltipTrigger>
											<TooltipContent>
												<p class="text-sm text-foreground">
													Requires Full-Text Search to be enabled
												</p>
											</TooltipContent>
										</Tooltip>
									{/if}
								</div>
								<p class="text-sm text-muted-foreground">
									Maximum number of search results to return (1-200).
								</p>
							</div>
							{#if !settingsQuery.loading}
								<input
									type="number"
									id="searchResultsLimit"
									name="searchResultsLimit"
									bind:value={formState.searchResultsLimit}
									min="1"
									max="200"
									class="flex h-10 w-32 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									disabled={isSubmitting || !formState.enableFullTextSearch}
								/>
							{:else}
								<Skeleton class="h-10" />
							{/if}
						</div>
					</CardContent>
				</Card>

				<!-- Backup Settings Section -->
				<Card class="border-none">
					<CardHeader>
						<div class="flex items-center space-x-2">
							<div class="h-2 w-2 rounded-full bg-orange-500"></div>
							<CardTitle class="text-xl font-semibold">Backup Settings</CardTitle>
						</div>
					</CardHeader>
					<CardContent class="space-y-4">
						<!-- File System Backup Toggle -->
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<label for="filesystemBackupEnabledSwitch" class="text-sm font-semibold">
									File System Database Backups
								</label>
								<p class="text-sm text-muted-foreground">
									When enabled, database backups will be saved locally to the file system. This
									provides quick local access to backup files for restoration.
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="filesystemBackupEnabled"
										value={formState.filesystemBackupEnabled ? 'true' : 'false'}
									/>
									<Switch
										id="filesystemBackupEnabledSwitch"
										bind:checked={formState.filesystemBackupEnabled}
										disabled={isSubmitting}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<!-- S3 Backup Toggle -->
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<label for="s3BackupEnabledSwitch" class="text-sm font-semibold">
									S3 Database Backups
								</label>
								<p class="text-sm text-muted-foreground">
									When enabled, database backups will be automatically uploaded to AWS S3. Requires
									AWS credentials to be configured via environment variables.
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="s3BackupEnabled"
										value={formState.s3BackupEnabled ? 'true' : 'false'}
									/>
									<Switch
										id="s3BackupEnabledSwitch"
										bind:checked={formState.s3BackupEnabled}
										disabled={isSubmitting}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<!-- R2 Backup Toggle -->
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<label for="r2BackupEnabledSwitch" class="text-sm font-semibold">
									Cloudflare R2 Database Backups
								</label>
								<p class="text-sm text-muted-foreground">
									When enabled, database backups will be automatically uploaded to Cloudflare R2.
									Requires R2 credentials to be configured via environment variables.
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="r2BackupEnabled"
										value={formState.r2BackupEnabled ? 'true' : 'false'}
									/>
									<Switch
										id="r2BackupEnabledSwitch"
										bind:checked={formState.r2BackupEnabled}
										disabled={isSubmitting}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<!-- Backup schedule cron input -->
						<div class="gap-2 space-y-3 rounded-lg border bg-card p-4">
							<div class="flex items-center">
								<label for="backupCronPattern" class="text-sm font-semibold">
									Backup Schedule (Cron)
								</label>
								<!-- Info icon if all backups are disabled -->
								{#if !formState.filesystemBackupEnabled && !formState.s3BackupEnabled && !formState.r2BackupEnabled}
									<Tooltip>
										<TooltipTrigger>
											<Info class="ml-2 h-4 w-4 text-muted-foreground" />
										</TooltipTrigger>
										<TooltipContent>
											<p class="text-sm text-foreground">
												Disabled if all backup types are disabled
											</p>
										</TooltipContent>
									</Tooltip>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">Cron expression for backup schedule</p>
							{#if !settingsQuery.loading}
								<CronJobInput
									id="backupCronPattern"
									name="backupCronPattern"
									bind:value={formState.backupCronPattern}
									disabled={isSubmitting ||
										(!formState.filesystemBackupEnabled &&
											!formState.s3BackupEnabled &&
											!formState.r2BackupEnabled)}
								/>
							{:else}
								<Skeleton class="h-10" />
							{/if}
						</div>

						<!-- Backup retention days -->
						<div class="gap-2 space-y-3 rounded-lg border bg-card p-4">
							<div class="flex items-center">
								<label for="backupRetentionDays" class="text-sm font-semibold">
									Backup Retention (Days, File System Only)
								</label>
								{#if !formState.filesystemBackupEnabled}
									<Tooltip>
										<TooltipTrigger>
											<Info class="ml-2 h-4 w-4 text-muted-foreground" />
										</TooltipTrigger>
										<TooltipContent>
											<p class="text-sm text-foreground">
												Disabled if file system backup is disabled. This setting only applies to
												local backup files.
											</p>
										</TooltipContent>
									</Tooltip>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">
								Number of days to keep local backup files. Older file system backups are
								automatically deleted. This does not affect S3 backups - use S3/R2 lifecycle
								policies for cloud retention.
							</p>
							{#if !settingsQuery.loading}
								<input
									type="number"
									id="backupRetentionDays"
									name="backupRetentionDays"
									bind:value={formState.backupRetentionDays}
									min="1"
									max="365"
									class="flex h-10 w-32 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									disabled={isSubmitting || !formState.filesystemBackupEnabled}
								/>
							{:else}
								<Skeleton class="h-10" />
							{/if}
						</div>

						<!-- Auto-zip toggle -->
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<div class="flex items-center">
									<label for="enableAutoZipSwitch" class="text-sm font-semibold"
										>Auto-Compress Backups</label
									>
									{#if !formState.filesystemBackupEnabled && !formState.s3BackupEnabled && !formState.r2BackupEnabled}
										<Tooltip>
											<TooltipTrigger>
												<Info class="ml-2 h-4 w-4 text-muted-foreground" />
											</TooltipTrigger>
											<TooltipContent>
												<p class="text-sm text-foreground">
													Disabled if all backup types are disabled
												</p>
											</TooltipContent>
										</Tooltip>
									{/if}
								</div>
								<p class="text-sm text-muted-foreground">
									When enabled, backup files will be automatically compressed into ZIP archives to
									save disk space. This is recommended for most installations.
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="enableAutoZip"
										value={formState.enableAutoZip ? 'true' : 'false'}
									/>
									<Switch
										id="enableAutoZipSwitch"
										bind:checked={formState.enableAutoZip}
										disabled={isSubmitting ||
											(!formState.filesystemBackupEnabled &&
												!formState.s3BackupEnabled &&
												!formState.r2BackupEnabled)}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>
					</CardContent>
				</Card>

				<!-- Rate Limiting Settings Section -->
				<Card class="border-none">
					<CardHeader>
						<div class="flex items-center space-x-2">
							<div class="h-2 w-2 rounded-full bg-purple-500"></div>
							<CardTitle class="text-xl font-semibold">Authenticated Rate Limiting</CardTitle>
						</div>
					</CardHeader>
					<CardContent class="space-y-4">
						<!-- Authenticated User Rate Limiting Toggle -->
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<label for="rateLimitingAuthedEnabledSwitch" class="text-sm font-semibold">
									Enable Rate Limiting (Authenticated Users)
								</label>
								<p class="text-sm text-muted-foreground">
									When enabled, authenticated users (non-admin) will be limited in the number of
									paste create and edit operations they can perform per minute. This helps prevent
									abuse and ensures fair resource usage.
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="rateLimitingAuthedEnabled"
										value={formState.rateLimitingAuthedEnabled ? 'true' : 'false'}
									/>
									<Switch
										id="rateLimitingAuthedEnabledSwitch"
										bind:checked={formState.rateLimitingAuthedEnabled}
										disabled={isSubmitting}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<!-- Rate Limit Value -->
						<div class="space-y-3 rounded-lg border bg-card p-4">
							<div class="flex items-center">
								<label for="rateLimitingAuthedLimit" class="text-sm font-semibold">
									Rate Limit (Requests per Minute)
								</label>
								{#if !formState.rateLimitingAuthedEnabled}
									<Tooltip>
										<TooltipTrigger>
											<Info class="ml-2 h-4 w-4 text-muted-foreground" />
										</TooltipTrigger>
										<TooltipContent>
											<p class="text-sm text-foreground">
												Disabled if rate limiting is not enabled
											</p>
										</TooltipContent>
									</Tooltip>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">
								Maximum number of paste create or edit operations an authenticated user can perform
								in a 1-minute sliding window (1-100,000). Admin users are automatically exempt from
								rate limiting.
							</p>
							{#if !settingsQuery.loading}
								<input
									type="number"
									id="rateLimitingAuthedLimit"
									name="rateLimitingAuthedLimit"
									bind:value={formState.rateLimitingAuthedLimit}
									min="1"
									max="100000"
									class="flex h-10 w-32 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									disabled={isSubmitting || !formState.rateLimitingAuthedEnabled}
								/>
							{:else}
								<Skeleton class="h-10" />
							{/if}
						</div>
					</CardContent>
				</Card>

				<!-- Unauthenticated Paste Creation Settings -->
				<Card class="border-none">
					<CardHeader>
						<div class="flex items-center space-x-2">
							<div class="h-2 w-2 rounded-full bg-green-500"></div>
							<CardTitle class="text-xl font-semibold">Unauthenticated Paste Creation</CardTitle>
						</div>
					</CardHeader>
					<CardContent class="space-y-4">
						<!-- Master Toggle -->
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<label for="enableUnauthenticatedPasteCreationSwitch" class="text-sm font-semibold">
									Allow Unauthenticated Paste Creation
								</label>
								<p class="text-sm text-muted-foreground">
									When enabled, users who are not logged in can create pastes. These pastes will be
									PUBLIC only and cannot be edited or deleted after creation.
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="enableUnauthenticatedPasteCreation"
										value={formState.enableUnauthenticatedPasteCreation ? 'true' : 'false'}
									/>
									<Switch
										id="enableUnauthenticatedPasteCreationSwitch"
										bind:checked={formState.enableUnauthenticatedPasteCreation}
										disabled={isSubmitting}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<!-- Per-User Rate Limiting Toggle -->
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<div class="flex items-center">
									<label
										for="rateLimitingUnauthenticatedEnabledSwitch"
										class="text-sm font-semibold"
									>
										Enable Per-User Rate Limiting
									</label>
									{#if !formState.enableUnauthenticatedPasteCreation}
										<Tooltip>
											<TooltipTrigger>
												<Info class="ml-2 h-4 w-4 text-muted-foreground" />
											</TooltipTrigger>
											<TooltipContent>
												<p class="text-sm text-foreground">
													Disabled if unauthenticated paste creation is not enabled
												</p>
											</TooltipContent>
										</Tooltip>
									{/if}
								</div>
								<p class="text-sm text-muted-foreground">
									Limit paste creation per unauthenticated user (identified by browser fingerprint).
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="rateLimitingUnauthenticatedEnabled"
										value={formState.rateLimitingUnauthenticatedEnabled ? 'true' : 'false'}
									/>
									<Switch
										id="rateLimitingUnauthenticatedEnabledSwitch"
										bind:checked={formState.rateLimitingUnauthenticatedEnabled}
										disabled={isSubmitting || !formState.enableUnauthenticatedPasteCreation}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<!-- Per-User Rate Limit Value -->
						<div class="gap-2 space-y-3 rounded-lg border bg-card p-4">
							<div class="flex items-center">
								<label for="rateLimitingUnauthenticatedLimit" class="text-sm font-semibold">
									Per-User Rate Limit (Requests per Minute)
								</label>
								{#if !formState.rateLimitingUnauthenticatedEnabled || !formState.enableUnauthenticatedPasteCreation}
									<Tooltip>
										<TooltipTrigger>
											<Info class="ml-2 h-4 w-4 text-muted-foreground" />
										</TooltipTrigger>
										<TooltipContent>
											<p class="text-sm text-foreground">
												Disabled if per-user rate limiting is not enabled
											</p>
										</TooltipContent>
									</Tooltip>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">
								Maximum number of paste create operations each unauthenticated user can perform in a
								1-minute sliding window (1-100,000).
							</p>
							{#if !settingsQuery.loading}
								<input
									type="number"
									id="rateLimitingUnauthenticatedLimit"
									name="rateLimitingUnauthenticatedLimit"
									bind:value={formState.rateLimitingUnauthenticatedLimit}
									min="1"
									max="100000"
									class="flex h-10 w-32 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									disabled={isSubmitting ||
										!formState.rateLimitingUnauthenticatedEnabled ||
										!formState.enableUnauthenticatedPasteCreation}
								/>
							{:else}
								<Skeleton class="h-10" />
							{/if}
						</div>

						<!-- Global Rate Limiting Toggle -->
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<div class="flex items-center">
									<label
										for="rateLimitingUnauthenticatedGlobalEnabledSwitch"
										class="text-sm font-semibold"
									>
										Enable Global Rate Limiting
									</label>
									{#if !formState.enableUnauthenticatedPasteCreation}
										<Tooltip>
											<TooltipTrigger>
												<Info class="ml-2 h-4 w-4 text-muted-foreground" />
											</TooltipTrigger>
											<TooltipContent>
												<p class="text-sm text-foreground">
													Disabled if unauthenticated paste creation is not enabled
												</p>
											</TooltipContent>
										</Tooltip>
									{/if}
								</div>
								<p class="text-sm text-muted-foreground">
									Limit total paste creation for all unauthenticated users system-wide.
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="rateLimitingUnauthenticatedGlobalEnabled"
										value={formState.rateLimitingUnauthenticatedGlobalEnabled ? 'true' : 'false'}
									/>
									<Switch
										id="rateLimitingUnauthenticatedGlobalEnabledSwitch"
										bind:checked={formState.rateLimitingUnauthenticatedGlobalEnabled}
										disabled={isSubmitting || !formState.enableUnauthenticatedPasteCreation}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<!-- Global Rate Limit Value -->
						<div class="gap-2 space-y-3 rounded-lg border bg-card p-4">
							<div class="flex items-center">
								<label for="rateLimitingUnauthenticatedGlobalLimit" class="text-sm font-semibold">
									Global Rate Limit (Requests per Minute)
								</label>
								{#if !formState.rateLimitingUnauthenticatedGlobalEnabled || !formState.enableUnauthenticatedPasteCreation}
									<Tooltip>
										<TooltipTrigger>
											<Info class="ml-2 h-4 w-4 text-muted-foreground" />
										</TooltipTrigger>
										<TooltipContent>
											<p class="text-sm text-foreground">
												Disabled if global rate limiting is not enabled
											</p>
										</TooltipContent>
									</Tooltip>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">
								Maximum total number of paste create operations for all unauthenticated users
								combined in a 1-minute sliding window (1-100,000).
							</p>
							{#if !settingsQuery.loading}
								<input
									type="number"
									id="rateLimitingUnauthenticatedGlobalLimit"
									name="rateLimitingUnauthenticatedGlobalLimit"
									bind:value={formState.rateLimitingUnauthenticatedGlobalLimit}
									min="1"
									max="100000"
									class="flex h-10 w-32 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									disabled={isSubmitting ||
										!formState.rateLimitingUnauthenticatedGlobalEnabled ||
										!formState.enableUnauthenticatedPasteCreation}
								/>
							{:else}
								<Skeleton class="h-10" />
							{/if}
						</div>
					</CardContent>
				</Card>

				<!-- Paste Expiry Settings Section -->
				<Card class="border-none">
					<CardHeader>
						<div class="flex items-center space-x-2">
							<div class="h-2 w-2 rounded-full bg-red-500"></div>
							<CardTitle class="text-xl font-semibold">Paste Expiry Settings</CardTitle>
						</div>
					</CardHeader>
					<CardContent class="space-y-4">
						<!-- Authenticated Users Force Expiry Toggle -->
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<label for="forceExpiryAuthedSwitch" class="text-sm font-semibold">
									Force Expiry (Authenticated Users)
								</label>
								<p class="text-sm text-muted-foreground">
									When enabled, all authenticated users (except admins) will have their paste expiry
									time enforced by the server.
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="forceExpiryAuthed"
										value={formState.forceExpiryAuthed ? 'true' : 'false'}
									/>
									<Switch
										id="forceExpiryAuthedSwitch"
										bind:checked={formState.forceExpiryAuthed}
										disabled={isSubmitting}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<!-- Authenticated Users Force Expiry Value -->
						<div class="space-y-3 rounded-lg border bg-card p-4">
							<div class="flex items-center">
								<label for="forceExpiryAuthedValue" class="text-sm font-semibold">
									Forced Expiry Time (Authenticated Users)
								</label>
								{#if !formState.forceExpiryAuthed}
									<Tooltip>
										<TooltipTrigger>
											<Info class="ml-2 h-4 w-4 text-muted-foreground" />
										</TooltipTrigger>
										<TooltipContent>
											<p class="text-sm text-foreground">
												Disabled if forced expiry is not enabled for authenticated users
											</p>
										</TooltipContent>
									</Tooltip>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">
								Default expiry time that will be enforced for all authenticated users when they
								create pastes.
							</p>
							{#if !settingsQuery.loading}
								<Select
									type="single"
									bind:value={formState.forceExpiryAuthedValue}
									disabled={isSubmitting || !formState.forceExpiryAuthed}
								>
									<SelectTrigger class="w-32 border-border bg-background text-sm">
										{EXPIRY_OPTIONS.find((opt) => opt.value === formState.forceExpiryAuthedValue)
											?.label || 'Select expiry'}
									</SelectTrigger>
									<SelectContent>
										{#each EXPIRY_OPTIONS.filter((opt) => opt.value !== '') as option (option.value)}
											<SelectItem value={option.value}>{option.label}</SelectItem>
										{/each}
									</SelectContent>
								</Select>
								<input
									type="hidden"
									name="forceExpiryAuthedValue"
									value={formState.forceExpiryAuthedValue}
								/>
							{:else}
								<Skeleton class="h-10 w-32" />
							{/if}
						</div>

						<!-- Unauthenticated Users Force Expiry Toggle -->
						<div class="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<label for="forceExpiryUnauthedSwitch" class="text-sm font-semibold">
									Force Expiry (Unauthenticated Users)
								</label>
								<p class="text-sm text-muted-foreground">
									When enabled, all unauthenticated users will have their paste expiry time enforced
									by the server.
								</p>
							</div>
							<div>
								{#if !settingsQuery.loading}
									<input
										type="hidden"
										name="forceExpiryUnauthed"
										value={formState.forceExpiryUnauthed ? 'true' : 'false'}
									/>
									<Switch
										id="forceExpiryUnauthedSwitch"
										bind:checked={formState.forceExpiryUnauthed}
										disabled={isSubmitting}
									/>
								{:else}
									<Skeleton class="h-6 w-11" />
								{/if}
							</div>
						</div>

						<!-- Unauthenticated Users Force Expiry Value -->
						<div class="space-y-3 rounded-lg border bg-card p-4">
							<div class="flex items-center">
								<label for="forceExpiryUnauthedValue" class="text-sm font-semibold">
									Forced Expiry Time (Unauthenticated Users)
								</label>
								{#if !formState.forceExpiryUnauthed}
									<Tooltip>
										<TooltipTrigger>
											<Info class="ml-2 h-4 w-4 text-muted-foreground" />
										</TooltipTrigger>
										<TooltipContent>
											<p class="text-sm text-foreground">
												Disabled if forced expiry is not enabled for unauthenticated users
											</p>
										</TooltipContent>
									</Tooltip>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">
								Default expiry time that will be enforced for all unauthenticated users when they
								create pastes.
							</p>
							{#if !settingsQuery.loading}
								<Select
									type="single"
									bind:value={formState.forceExpiryUnauthedValue}
									disabled={isSubmitting || !formState.forceExpiryUnauthed}
								>
									<SelectTrigger class="w-32 border-border bg-background text-sm">
										{EXPIRY_OPTIONS.find((opt) => opt.value === formState.forceExpiryUnauthedValue)
											?.label || 'Select expiry'}
									</SelectTrigger>
									<SelectContent>
										{#each EXPIRY_OPTIONS.filter((opt) => opt.value !== '') as option (option.value)}
											<SelectItem value={option.value}>{option.label}</SelectItem>
										{/each}
									</SelectContent>
								</Select>
								<input
									type="hidden"
									name="forceExpiryUnauthedValue"
									value={formState.forceExpiryUnauthedValue}
								/>
							{:else}
								<Skeleton class="h-10 w-32" />
							{/if}
						</div>
					</CardContent>
				</Card>

				<!-- Save Button -->
				<div class="flex justify-end">
					<Button
						type="submit"
						class="min-w-40 px-8 py-2"
						disabled={isSubmitting || settingsQuery.loading}
					>
						{isSubmitting ? 'Saving...' : 'Save Settings'}
					</Button>
				</div>
			</form>
		</div>
	</div>
</TooltipProvider>
