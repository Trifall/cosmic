<script lang="ts">
	import { Input } from '@/src/lib/components/ui/input';
	import { SUPPORTED_LANGUAGES, getLanguageDisplayName } from '@/src/lib/shared/languages';
	import { detectLanguage } from '@/src/lib/utils/highlight';
	import { Code } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let {
		pasteContent,
		language = $bindable('plaintext'),
		initialLanguage,
		disableAutoDetect,
		initialAutoDetectState = true,
		disabled = false,
	}: {
		pasteContent: string;
		language: string;
		initialLanguage?: string;
		disableAutoDetect?: boolean;
		initialAutoDetectState?: boolean;
		disabled?: boolean;
	} = $props();

	// auto-detect state
	let autoDetectEnabled = $derived(initialAutoDetectState);
	let detectedLanguage = $state('plaintext');
	let detectionTimeout: ReturnType<typeof setTimeout> | null = null;

	let searchQuery = $state('');

	// detected language when auto-detect is on, otherwise shows selected language
	let displayLanguage = $derived(autoDetectEnabled ? detectedLanguage : language);

	// initialize language from initialLanguage on mount if provided
	onMount(() => {
		if (initialLanguage && initialLanguage.length > 0) {
			language = initialLanguage;
			detectedLanguage = initialLanguage;
			autoDetectEnabled = false; // disable auto-detect when initial language is set
		}
	});

	// auto-detect language on pasteContent change (debounced, triggered on any changes)
	$effect(() => {
		if (!autoDetectEnabled || disableAutoDetect) {
			return;
		}

		// if pasteContent is empty or very short, always reset to plaintext
		if (!pasteContent || pasteContent.length < 10) {
			detectedLanguage = 'plaintext';
			language = 'plaintext';
			// clear any pending detection timeout
			if (detectionTimeout) {
				clearTimeout(detectionTimeout);
				detectionTimeout = null;
			}
			return;
		}

		// only trigger detection if pasteContent has meaningful length and contains newlines or is long enough
		const hasNewline = pasteContent.includes('\n');
		const shouldDetect = hasNewline || pasteContent.length > 50;

		if (shouldDetect) {
			// clear existing timeout
			if (detectionTimeout) {
				clearTimeout(detectionTimeout);
			}

			// debounce detection by 500ms
			detectionTimeout = setTimeout(() => {
				const detected = detectLanguage(pasteContent);
				detectedLanguage = detected;
				// also update the actual language value for form submission
				language = detected;
			}, 500);
		}
	});

	let filteredLanguages = $derived(
		SUPPORTED_LANGUAGES.filter((lang) => {
			const displayName = getLanguageDisplayName(lang);
			const queryLower = searchQuery.toLowerCase();
			return (
				lang.toLowerCase().includes(queryLower) || displayName.toLowerCase().includes(queryLower)
			);
		})
	);

	const toggleAutoDetect = () => {
		if (disableAutoDetect) {
			return;
		}
		autoDetectEnabled = !autoDetectEnabled;
		if (!autoDetectEnabled) {
			// when disabling auto-detect, keep the current detected/selected language
			language = detectedLanguage;
		} else {
			// when enabling auto-detect, immediately detect language if pasteContent exists
			if (pasteContent && pasteContent.includes('\n')) {
				const detected = detectLanguage(pasteContent);
				detectedLanguage = detected;
				language = detected;
			}
		}
	};
</script>

<!-- Language Selector -->
<div class="border-t border-border pt-4">
	<div class="mb-3 flex items-center justify-between">
		<h3 class="text-sm font-semibold tracking-wider text-foreground">
			Language (Syntax Highlighting)
		</h3>
		{#if !disableAutoDetect}
			<button
				type="button"
				onclick={toggleAutoDetect}
				class="min-w-fit rounded px-2 py-1 text-xs font-medium transition-colors {autoDetectEnabled
					? 'bg-primary text-primary-foreground'
					: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
				title={autoDetectEnabled ? 'Auto-detect enabled' : 'Auto-detect disabled'}
				{disabled}
			>
				{autoDetectEnabled ? '✓ Auto' : 'Manual'}
			</button>
		{/if}
	</div>
	{#if initialLanguage && initialLanguage.length > 0}
		<div class="mb-4">
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
				>
					<Code size={16} class="text-muted-foreground" />
				</div>
				<div>
					<div class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
						Original Language
					</div>
					<div class="font-semibold text-foreground">
						{getLanguageDisplayName(initialLanguage)}
					</div>
				</div>
			</div>
		</div>
	{/if}
	{#if autoDetectEnabled && !disableAutoDetect}
		<div class="mb-2 rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground">
			Detected: <span class="font-semibold text-foreground"
				>{getLanguageDisplayName(displayLanguage)}</span
			>
		</div>
	{/if}
	<Input
		bind:value={searchQuery}
		placeholder="Filter languages..."
		class="mb-2 border-border bg-background text-sm"
		{disabled}
	/>
	<div
		class="max-h-40 overflow-y-auto rounded border border-border bg-background {autoDetectEnabled
			? 'opacity-50'
			: ''}"
	>
		{#each filteredLanguages as lang (lang)}
			<button
				type="button"
				onclick={() => {
					language = lang;
					autoDetectEnabled = false;
				}}
				class={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
					!autoDetectEnabled && language === lang
						? 'bg-primary font-semibold text-primary-foreground'
						: 'text-foreground'
				} border-b border-border last:border-b-0 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
				{disabled}
			>
				{getLanguageDisplayName(lang)}
			</button>
		{/each}
		{#if filteredLanguages.length <= 0}
			<p class="px-3 py-2 text-sm text-muted-foreground">No languages found</p>
		{/if}
	</div>
</div>
