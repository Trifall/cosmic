<script lang="ts">
	import ExpiresAtWarning from '@/src/lib/components/side-panel/expires-at-warning.svelte';
	import LanguageSelector from '@/src/lib/components/side-panel/language-selector.svelte';
	import SideBar from '@/src/lib/components/side-panel/side-bar.svelte';
	import { getFileExtension, getLanguageDisplayName } from '@/src/lib/shared/languages';
	import {
		formatDateRelativeToNow,
		getPublicSiteName,
		sanitizeFilename,
	} from '@/src/lib/utils/format';
	import {
		ArrowUp,
		BookOpen,
		Calendar,
		Copy,
		Download,
		ExternalLink,
		Eye,
		GitForkIcon,
		Globe,
		Hash,
		History,
		Link,
		Lock,
		LockIcon,
		PenLine,
		User,
		UserCheck,
		Users,
	} from '@lucide/svelte';
	import { ScrollState } from 'runed';
	import { toast } from 'svelte-sonner';
	import CodeHighlighter from '$lib/components/CodeHighlighter.svelte';
	import MarkdownViewer from '$lib/components/MarkdownViewer.svelte';
	import { Button } from '$lib/components/ui/button';
	import type { SinglePasteData } from '$src/lib/shared/pastes';
	import { downloadMarkdown } from '$src/lib/utils/download-markdown';
	import UserInviteViewer from '$components/side-panel/user-invite-viewer.svelte';
	import type { ActionData, PageData } from './$types';
	import PasswordCard from './password-card.svelte';

	let { data }: { data: PageData; form: ActionData } = $props();

	// scroll state for the content area
	let scrollContainer = $state<HTMLElement>();
	const scrollState = new ScrollState({
		element: () => scrollContainer,
		behavior: 'smooth',
	});

	// language selector state
	let selectedLanguage = $state(data.paste?.language || 'plaintext');

	// check if we're in markdown viewing mode
	const isMarkdownMode = $derived(selectedLanguage === 'markdown');

	// sidebar collapsed state for button positioning
	let sidebarCollapsed = $state(false);

	// version dropdown state
	let showVersions = $state(false);

	// version display helper (selected or current)
	const viewingVersion = $derived(data.selectedVersion || data.paste?.currentVersion || 1);

	// show scroll-to-top button when scrolled down more than 200px
	const showScrollToTop = $derived(scrollState.y > 200);

	// visibility icon mapping
	const visibilityConfig = {
		PUBLIC: { icon: Globe, label: 'Public', color: 'bg-green-500' },
		AUTHENTICATED: { icon: UserCheck, label: 'Authenticated Only', color: 'bg-blue-500' },
		INVITE_ONLY: { icon: Users, label: 'Invite Only', color: 'bg-orange-500' },
		PRIVATE: { icon: Lock, label: 'Private', color: 'bg-red-500' },
	};

	const copyToClipboard = async (text: string | null | undefined, message?: string) => {
		if (!text) {
			return;
		}
		try {
			await navigator.clipboard.writeText(text);
			toast.success(message || 'Copied to clipboard');
		} catch (error) {
			console.error('Failed to copy to clipboard:', error);
			toast.error('Failed to copy to clipboard');
		}
	};

	const copyPasteUrl = async () => {
		const url = window.location.href;
		await copyToClipboard(url, 'Copied paste URL to clipboard');
	};

	// get the appropriate visibility configuration
	const visibilityInfo = $derived(
		visibilityConfig[data.paste?.visibility || 'PUBLIC'] || visibilityConfig.PUBLIC
	);

	// helpers to navigate with version param
	const goToVersion = (version: number | null) => {
		const url = new URL(window.location.href);
		if (version && version > 0) {
			url.searchParams.set('version', String(version));
		} else {
			url.searchParams.delete('version');
		}
		window.location.href = url.toString();
	};

	// fork paste function
	const forkPaste = () => {
		if (!data.paste) return;

		const url = new URL(window.location.origin);
		url.searchParams.set('forkedFrom', data.paste.id);

		// include version if viewing a specific version
		if (data.selectedVersion) {
			url.searchParams.set('version', String(data.selectedVersion));
		}

		window.location.href = url.toString();
	};

	// scroll to top function
	const scrollToTop = () => {
		scrollState.scrollToTop();
	};

	const downloadPaste = () => {
		if (!data.paste?.content) return;

		try {
			let blob: Blob;
			let extension: string;

			if (isMarkdownMode) {
				// in markdown mode, download rendered HTML
				downloadMarkdown(data.paste as SinglePasteData);
			} else {
				// normal code mode, download as text
				blob = new Blob([data.paste.content], { type: 'text/plain' });
				const url = URL.createObjectURL(blob);

				// determine filename with appropriate extension
				extension = getFileExtension(selectedLanguage);
				const filename = sanitizeFilename(
					`${data.paste.title || data.paste.customSlug || data.paste.id}`,
					extension,
					250
				);

				// create temporary link and trigger download
				const a = document.createElement('a');
				a.href = url;
				a.download = filename;
				a.style.display = 'none';
				document.body.appendChild(a);
				a.click();

				// cleanup
				setTimeout(() => {
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
				}, 100);
			}
		} catch (error) {
			console.error('Failed to download paste:', error);
			toast.error('Failed to download paste');
		}
	};
</script>

<svelte:head>
	<title
		>{data.paste?.title || data.paste?.customSlug || data.paste?.id || 'Paste'} - {getPublicSiteName()}</title
	>
</svelte:head>

<!-- Password Card -->
{#if data.passwordRequired && !data.paste}
	<PasswordCard
		onSuccess={(pasteData: any) => {
			data = { ...data, ...pasteData };
		}}
	/>
{:else if data.paste}
	<div class="fixed inset-0 top-14 flex">
		<!-- Main Content Area -->
		<div class="relative min-w-0 flex-1">
			{#if data.paste.content}
				<!-- Code Content Container with proper scrolling -->
				<div class="absolute inset-0 flex flex-col">
					<!-- Fixed Header - doesn't scroll with code -->
					<div
						class="flex min-w-0 flex-shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 py-2 text-base font-medium text-foreground"
					>
						<span class="shrink-0">{getLanguageDisplayName(selectedLanguage)}</span>
						<span class="shrink-0 text-muted-foreground">•</span>
						<span
							class="min-w-[60px] max-w-[200px] truncate"
							title={data.paste.ownerUsername ?? 'Guest'}
							>by {data.paste.ownerUsername ?? 'Guest'}</span
						>
						<div class="hidden shrink-0 md:inline">
							<span class="mx-1 text-muted-foreground">•</span>
							<span class="text-primary">{data.paste.content.split('\n').length}</span>
							<span class="">lines</span>
						</div>
						<span class="shrink-0 text-muted-foreground">•</span>

						<!-- copy paste content quick button -->
						<button
							type="button"
							onclick={() =>
								copyToClipboard(data.paste?.content, 'Copied paste content to clipboard')}
							class="rounded-full px-1 pt-1 text-foreground hover:text-primary"
							title="Copy content to clipboard"
						>
							<Copy size={16} />
						</button>
						<!-- copy link to paste quick button -->
						<button
							type="button"
							onclick={copyPasteUrl}
							class="rounded-full px-1 pt-1 text-foreground hover:text-primary"
							title="Copy link to paste"
						>
							<ExternalLink size={16} />
						</button>
						{#if data.canViewVersions}
							<span class="mr-1 text-muted-foreground">•</span>
							<span
								class="mt-0.5 hidden items-center self-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground lg:inline-flex"
							>
								Version: v{viewingVersion}
								<span class="hidden pl-1 xl:inline"
									>{data.selectedVersion === null ? ' (Latest)' : ''}</span
								>
							</span>
							<button
								type="button"
								class="rounded-full px-1 pt-1 text-foreground hover:text-primary"
								title="View versions"
								onclick={(e) => {
									e.stopPropagation();
									showVersions = !showVersions;
								}}
							>
								<History size={16} />
							</button>
							{#if showVersions}
								<div class="relative inline-block">
									<div
										class="absolute left-0 top-full z-[100] max-h-64 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
									>
										<div class="border-b px-2 py-1.5 text-xs font-bold text-foreground">
											Version history
										</div>
										<button
											class={`mt-2 w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${data.selectedVersion === null ? 'bg-primary/90' : ''}`}
											onclick={() => goToVersion(null)}
											>Latest (v{data.paste.currentVersion})</button
										>
										{#each data.versions as v (v.versionNumber)}
											<button
												class={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${v.versionNumber === viewingVersion ? 'bg-primary/90' : ''}`}
												onclick={() => goToVersion(v.versionNumber)}
											>
												<div class="flex items-center justify-between">
													<span>v{v.versionNumber}</span>
													{#if v.delta !== undefined}
														<span class="text-xs font-semibold text-muted-foreground"
															>Δ {v.delta}</span
														>
													{/if}
												</div>
												<div class="text-xs text-muted-foreground">
													{formatDateRelativeToNow(v.createdAt)}
												</div>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						{/if}
						<span class="shrink-0 text-muted-foreground">•</span>
						<button
							type="button"
							class="relative flex flex-row items-center justify-center gap-1 rounded-full px-1 text-foreground hover:text-primary"
							title="Download paste"
							onclick={downloadPaste}
						>
							<span class="hidden md:block"> Download </span>
							<Download size={16} class="mt-1" />
						</button>
						{#if data.canCreatePastes}
							<span class="shrink-0 text-muted-foreground">•</span>
							<button
								type="button"
								class="relative flex flex-row items-center justify-center gap-1 rounded-full px-1 text-foreground hover:text-primary"
								title="Fork paste"
								onclick={forkPaste}
							>
								<span class="hidden md:block"> Fork </span>
								<GitForkIcon size={16} class="mt-1" />
							</button>
						{/if}
					</div>
					<!-- Scrollable Code Content Area -->
					<div bind:this={scrollContainer} class="min-h-0 flex-1 overflow-auto bg-background">
						<div class="relative px-4 {isMarkdownMode ? 'py-6' : ''}">
							{#if isMarkdownMode}
								<div class="container max-w-5xl border-l border-r">
									<MarkdownViewer content={data.paste.content} />
								</div>
							{:else}
								<CodeHighlighter code={data.paste.content} language={selectedLanguage} />
							{/if}
						</div>

						<!-- Scroll to Top Button -->
						{#if showScrollToTop}
							<button
								type="button"
								onclick={scrollToTop}
								class="fixed bottom-[5%] z-50 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 ease-in-out hover:scale-110 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 {sidebarCollapsed
									? 'right-12'
									: 'right-[325px] sm:right-[352px]'}"
								title="Scroll to top"
							>
								<ArrowUp size={18} />
							</button>
						{/if}
					</div>
				</div>
			{:else}
				<div class="absolute inset-0 flex items-center justify-center text-muted-foreground">
					<p>This paste appears to be empty.</p>
				</div>
			{/if}
		</div>
		<SideBar bind:collapsed={sidebarCollapsed}>
			<div class="space-y-5 xl:space-y-6">
				<!-- Title/ID Display -->
				<div class="">
					<div class="mb-2 text-lg font-bold leading-tight text-foreground xl:mb-3 xl:text-xl">
						{#if data.paste.title}
							{data.paste.title}
						{:else}
							{data.paste.customSlug ? `No Title (/${data.paste.customSlug})` : `No Title`}
						{/if}
					</div>
				</div>

				<!-- Creator Information -->
				<div class="border-t border-border pt-4">
					<h3
						class="mb-2 text-sm font-semibold uppercase tracking-wider text-foreground xl:mb-3 xl:text-base"
					>
						Creator
					</h3>
					<div class="flex items-center gap-3 text-base font-semibold text-foreground xl:text-lg">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-primary"
						>
							<User size={16} class="text-primary-foreground xl:size-[18px]" />
						</div>
						<div>
							<div class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
								Username
							</div>
							<div class="text-sm font-semibold text-foreground xl:text-base">
								{data.paste.ownerUsername ? `@${data.paste.ownerUsername}` : 'Guest'}
							</div>
						</div>
					</div>
				</div>

				<!-- Visibility Status -->
				<div class="border-t border-border pt-4">
					<h3
						class="mb-2 text-sm font-semibold uppercase tracking-wider text-foreground xl:mb-3 xl:text-base"
					>
						Visibility
					</h3>
					<div class="flex items-center gap-3 text-base font-semibold text-foreground xl:text-lg">
						{#if visibilityInfo}
							{@const IconComponent = visibilityInfo.icon}
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full {visibilityInfo.color}"
							>
								<IconComponent size={16} class="text-white xl:size-[18px]" />
							</div>
							<span>{visibilityInfo.label}</span>
						{/if}
					</div>

					<!-- Invited Users List (only for INVITE_ONLY visibility) -->
					{#if data.paste.visibility === 'INVITE_ONLY' && data.invitedUsers.length > 0}
						<UserInviteViewer invitedUsers={data.invitedUsers} />
					{/if}

					<div class="flex items-center gap-3 pt-4">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
						>
							<LockIcon size={16} class="text-muted-foreground xl:size-[18px]" />
						</div>
						<div>
							<div class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
								Password Protected
							</div>
							<div class="text-sm font-semibold text-foreground xl:text-base">
								{data.paste.hasPassword ? 'Yes' : 'No'}
							</div>
						</div>
					</div>
				</div>

				<!-- Language Selector -->
				<LanguageSelector
					pasteContent={data.paste.content}
					bind:language={selectedLanguage}
					initialLanguage={data.paste.language}
					disableAutoDetect
				/>

				<!-- Expiry warning info (if exists )-->
				{#if data.paste.expiresAt}
					<ExpiresAtWarning currentExpiresAt={data.paste.expiresAt} />
				{/if}

				<!-- Metadata -->
				<div class="border-t border-border pb-4 pt-4">
					<h3
						class="mb-2 text-sm font-semibold uppercase tracking-wider text-foreground xl:mb-3 xl:text-base xl:font-semibold"
					>
						Information
					</h3>
					<div class="space-y-3 xl:space-y-4">
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
							>
								<Calendar size={16} class="text-muted-foreground xl:size-[18px]" />
							</div>
							<div>
								<div class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
									Created
								</div>
								<div class="text-sm font-semibold text-foreground xl:text-base">
									{formatDateRelativeToNow(data.paste.createdAt)}
								</div>
							</div>
						</div>
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
							>
								<Eye size={16} class="text-muted-foreground xl:size-[18px]" />
							</div>
							<div>
								<div class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
									Views
								</div>
								<div class="text-sm font-semibold text-foreground xl:text-base">
									{data.paste.views.toLocaleString()}
								</div>
							</div>
						</div>
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
							>
								<Hash size={16} class="text-muted-foreground xl:size-[18px]" />
							</div>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
									Paste ID
								</div>
								<div class="break-all font-mono font-semibold text-foreground xl:text-base">
									{data.paste.id}
								</div>
							</div>
						</div>
						{#if data.paste.customSlug && data.paste.customSlug !== data.paste.id}
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
								>
									<Link size={16} class="text-muted-foreground xl:size-[18px]" />
								</div>
								<div class="min-w-0 flex-1">
									<div class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
										Custom URL
									</div>
									<div class="break-all font-mono font-semibold text-foreground xl:text-base">
										{data.paste.customSlug}
									</div>
								</div>
							</div>
						{/if}
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
							>
								<span class="text-xs font-bold text-foreground">v</span>
							</div>
							<div>
								<div class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
									Selected Version
								</div>
								<div class="text-sm font-semibold text-foreground xl:text-base">
									{data.selectedVersion || data.paste.currentVersion}
									{data.selectedVersion === null ? ' (Latest)' : ''}
								</div>
							</div>
						</div>

						{#if data.paste.burnAfterReading}
							<div
								class="mt-3 flex items-center gap-2 rounded bg-orange-100 px-3 py-2 dark:bg-orange-900/20"
							>
								<span class="text-sm">🔥</span>
								<span
									class="text-xs font-medium uppercase tracking-wide text-orange-700 dark:text-orange-400"
									>Burn after reading</span
								>
							</div>
						{/if}
					</div>
				</div>

				<!-- Actions -->
				<div class="!mt-1 space-y-3">
					<Button
						onclick={() => {
							if (isMarkdownMode) {
								// copy rendered HTML in markdown mode
								import('marked').then(({ marked }) => {
									import('isomorphic-dompurify').then((DOMPurifyModule) => {
										const DOMPurify = DOMPurifyModule.default;
										const rawHtml = marked.parse(data.paste!.content) as string;
										const sanitized = DOMPurify.sanitize(rawHtml);
										copyToClipboard(sanitized, 'Copied rendered HTML to clipboard');
									});
								});
							} else {
								copyToClipboard(data.paste?.content, 'Copied paste content to clipboard');
							}
						}}
						class="h-11 w-full bg-orange-500 font-medium text-white hover:bg-orange-600 xl:text-base"
					>
						<Copy size={18} />
						{isMarkdownMode ? 'Copy HTML' : 'Copy Content'}
					</Button>

					<div class="grid grid-cols-2 gap-2">
						<Button variant="outline" onclick={copyPasteUrl} class="h-10 font-medium xl:text-base">
							<Copy size={14} />
							Copy URL
						</Button>

						<Button
							variant="outline"
							href="/{data.paste.customSlug || data.paste.id}/raw{data.selectedVersion
								? `?version=${data.selectedVersion}`
								: ''}"
							target="_blank"
							class="h-10 font-medium xl:text-base"
						>
							<ExternalLink size={14} />
							View Raw
						</Button>
					</div>

					{#if data.canEdit}
						<Button
							variant="outline"
							href="/{data.paste.customSlug || data.paste.id}/edit"
							class="h-10 w-full font-medium xl:text-base"
						>
							<PenLine size={16} />
							Edit Paste
						</Button>
					{/if}

					<Button
						variant="outline"
						onclick={downloadPaste}
						class="h-10 w-full font-medium xl:text-base"
					>
						<Download size={16} />
						Download Paste
					</Button>

					{#if data.canCreatePastes}
						<Button
							variant="outline"
							onclick={forkPaste}
							class="h-10 w-full font-medium xl:text-base"
						>
							<GitForkIcon size={16} />
							Fork Paste
						</Button>
					{/if}
					{#if !isMarkdownMode}
						<Button
							variant="outline"
							onclick={() => (selectedLanguage = 'markdown')}
							class="h-10 w-full font-medium xl:text-base"
						>
							<BookOpen size={16} />
							View as Markdown
						</Button>
					{/if}
				</div>
			</div></SideBar
		>
	</div>
{:else if data.passwordRequired}
	<!-- Password Required State -->
	<div class="fixed inset-0 top-14 flex items-center justify-center bg-background">
		<div class="mx-auto max-w-md space-y-6 p-6 text-center">
			<div
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20"
			>
				<Lock size={32} class="text-orange-600 dark:text-orange-400" />
			</div>
			<div>
				<h2 class="text-2xl font-bold text-foreground">Password Required</h2>
				<p class="mt-2 text-muted-foreground">
					This paste is password protected. Please enter the password to continue.
				</p>
			</div>
		</div>
	</div>
{:else}
	<!-- Error State -->
	<div class="fixed inset-0 top-14 flex items-center justify-center bg-background">
		<div class="mx-auto max-w-md space-y-6 p-6 text-center">
			<div
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20"
			>
				<Lock size={32} class="text-red-600 dark:text-red-400" />
			</div>
			<div>
				<h2 class="text-2xl font-bold text-foreground">Access Denied</h2>
				<p class="mt-2 text-muted-foreground">You don't have permission to view this paste.</p>
			</div>
		</div>
	</div>
{/if}
