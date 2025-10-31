<script lang="ts">
	import { ensureLanguagesRegistered } from '@/src/lib/utils/highlight';
	import hljs from 'highlight.js/lib/core';
	import { browser } from '$app/environment';
	import { Spinner } from '$lib/components/ui/spinner';

	interface Props {
		code: string;
		language?: string;
		class?: string;
	}

	let { code, language = 'plaintext', class: className = '' }: Props = $props();

	let highlightedCode = $state('');
	let isLoading = $state(true);
	let hasError = $state(false);
	let languagesRegistered = $state(false);

	// register all supported languages once
	const registerLanguages = () => {
		if (languagesRegistered) return;

		// all languages are registered when highlight module loads
		ensureLanguagesRegistered();
		languagesRegistered = true;
	};

	// highlight code when component mounts or props change
	$effect(() => {
		if (!browser) return;

		isLoading = true;
		hasError = false;

		try {
			// register languages if not already done
			registerLanguages();

			// normalize language
			const normalizedLang = normalizeLanguage(language);

			// highlight the code
			const result = hljs.highlight(code, {
				language: normalizedLang,
				ignoreIllegals: true,
			});

			// wrap in pre/code with line numbers
			highlightedCode = wrapWithLineNumbers(result.value);
		} catch (error) {
			console.error('Failed to highlight code:', error);
			hasError = true;
			// fallback to plain text display
			highlightedCode = wrapWithLineNumbers(escapeHtml(code));
		} finally {
			isLoading = false;
		}
	});

	// normalize language names to match highlight.js expected formats
	const normalizeLanguage = (lang: string): string => {
		const langMap: Record<string, string> = {
			js: 'javascript',
			ts: 'typescript',
			py: 'python',
			rb: 'ruby',
			sh: 'bash',
			yml: 'yaml',
			text: 'plaintext',
			txt: 'plaintext',
			md: 'markdown',
			proto: 'protobuf',
			nim: 'plaintext',
			v: 'plaintext',
			sass: 'scss',
			postcss: 'css',
			toml: 'ini',
			csv: 'plaintext',
			mdx: 'markdown',
			prisma: 'javascript',
			svelte: 'html',
			vue: 'html',
			jsx: 'javascript',
			tsx: 'typescript',
			astro: 'html',
			'angular-html': 'html',
			'angular-ts': 'typescript',
			handlebars: 'html',
			twig: 'html',
			liquid: 'html',
			'php-html': 'php',
			blade: 'php',
			wasm: 'plaintext',
		};

		const normalized = lang.toLowerCase().trim();
		return langMap[normalized] || normalized;
	};

	// wrap highlighted code with line numbers
	const wrapWithLineNumbers = (html: string): string => {
		// create a temporary element to parse the highlighted HTML
		const container = document.createElement('div');
		container.innerHTML = html;

		// get all text nodes and track their styling
		const lines: string[] = [];
		let currentLine = '';
		const openSpans: Array<{ tagName: string; className: string }> = [];

		const processNode = (node: Node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = node.textContent || '';
				let i = 0;

				while (i < text.length) {
					if (text[i] === '\n') {
						// close all open spans
						for (let j = openSpans.length - 1; j >= 0; j--) {
							currentLine += `</span>`;
						}
						lines.push(currentLine);
						currentLine = '';

						// reopen spans on next line
						for (const span of openSpans) {
							currentLine += `<span class="${span.className}">`;
						}
					} else {
						// escape HTML entities to prevent breaking the structure
						const char = text[i];
						if (char === '<') {
							currentLine += '&lt;';
						} else if (char === '>') {
							currentLine += '&gt;';
						} else if (char === '&') {
							currentLine += '&amp;';
						} else {
							currentLine += char;
						}
					}
					i++;
				}
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const element = node as Element;
				const className = element.className || '';

				// opening tag
				currentLine += `<${element.tagName.toLowerCase()}`;
				if (className) {
					currentLine += ` class="${className}"`;
				}
				currentLine += '>';

				// track this span
				openSpans.push({ tagName: element.tagName.toLowerCase(), className });

				// process children
				for (const child of Array.from(element.childNodes)) {
					processNode(child);
				}

				// closing tag
				currentLine += `</${element.tagName.toLowerCase()}>`;
				openSpans.pop();
			}
		};

		// process all child nodes
		for (const child of Array.from(container.childNodes)) {
			processNode(child);
		}

		// add last line if any
		if (currentLine) {
			// close any remaining spans
			for (let j = openSpans.length - 1; j >= 0; j--) {
				currentLine += `</span>`;
			}
			lines.push(currentLine);
		}

		// wrap each line
		const numberedLines = lines
			.map((line) => `<span class="line">${line || ' '}</span>`)
			.join('\n');
		return `<pre><code class="hljs">${numberedLines}</code></pre>`;
	};

	const escapeHtml = (text: string): string => {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	};
</script>

{#if isLoading}
	<div class="flex h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
		<Spinner size={48} />
	</div>
{:else if hasError}
	<pre><code
			class="block whitespace-pre !bg-transparent p-4 font-mono !text-lg leading-6 {className}"
			>{code}</code
		></pre>
{:else}
	<div class="hljs-container {className}">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html highlightedCode}
	</div>
{/if}

<style>
	:global(.hljs-container) {
		font-family: 'Fira Mono', 'JetBrains Mono', 'Monaco', 'Consolas', monospace !important;
		font-size: 1.125rem !important;
		line-height: 1.6 !important;
		overflow: visible !important;
	}

	:global(.hljs-container pre) {
		background: transparent !important;
		padding: 0.5rem 0rem 0.2rem 0 !important;
		margin: 0 !important;
		border: none !important;
		overflow: visible !important;
	}

	:global(.hljs-container pre code) {
		padding-top: 0.2rem !important;
	}

	:global(.hljs-container code.hljs) {
		font-family: inherit !important;
		font-size: inherit !important;
		line-height: inherit !important;
		background: transparent !important;
		display: block !important;
		white-space: pre !important;
		padding-left: 0 !important;
		padding-bottom: 0 !important;
		padding-right: 0 !important;
		overflow: visible !important;
	}

	/* ensure all nested highlight spans maintain proper inline flow */
	:global(.hljs-container .line span) {
		white-space: pre !important;
	}

	/* line number styling */
	:global(.hljs-container .line) {
		display: block;
		counter-increment: line;
		width: 100%;
		overflow: visible !important;
		text-indent: 0 !important;
	}

	/* prevent nested spans from causing layout shifts */
	:global(.hljs-container .line > *) {
		text-indent: 0 !important;
	}

	/* CSS counters for line numbers */
	:global(.hljs-container code.hljs) {
		counter-reset: line;
	}

	:global(.hljs-container .line::before) {
		content: counter(line);
		display: inline-block;
		min-width: 2.5rem;
		margin-right: 0.75rem;
		text-align: right;
		user-select: none;
	}

	/* Light theme line numbers */
	:global(html:not(.dark) .hljs-container .line::before) {
		color: #6e7781 !important;
	}

	/* Dark theme line numbers */
	:global(html.dark .hljs-container .line::before),
	:global([data-theme='dark'] .hljs-container .line::before) {
		color: #8b949e !important;
	}

	/* ============================================ */
	/* LIGHT MODE SYNTAX HIGHLIGHTING */
	/* ============================================ */
	:global(html:not(.dark) .hljs-container .hljs) {
		color: #24292f;
	}

	/* Keywords - prettylights-syntax-keyword */
	:global(html:not(.dark) .hljs-container .hljs-doctag),
	:global(html:not(.dark) .hljs-container .hljs-keyword),
	:global(html:not(.dark) .hljs-container .hljs-meta .hljs-keyword),
	:global(html:not(.dark) .hljs-container .hljs-template-tag),
	:global(html:not(.dark) .hljs-container .hljs-template-variable),
	:global(html:not(.dark) .hljs-container .hljs-type),
	:global(html:not(.dark) .hljs-container .hljs-variable.language_) {
		color: #cf222e;
	}

	/* Entity - prettylights-syntax-entity */
	:global(html:not(.dark) .hljs-container .hljs-title),
	:global(html:not(.dark) .hljs-container .hljs-title.class_),
	:global(html:not(.dark) .hljs-container .hljs-title.class_.inherited__),
	:global(html:not(.dark) .hljs-container .hljs-title.function_) {
		color: #8250df;
	}

	/* Constants - prettylights-syntax-constant */
	:global(html:not(.dark) .hljs-container .hljs-attr),
	:global(html:not(.dark) .hljs-container .hljs-attribute),
	:global(html:not(.dark) .hljs-container .hljs-literal),
	:global(html:not(.dark) .hljs-container .hljs-meta),
	:global(html:not(.dark) .hljs-container .hljs-number),
	:global(html:not(.dark) .hljs-container .hljs-operator),
	:global(html:not(.dark) .hljs-container .hljs-variable),
	:global(html:not(.dark) .hljs-container .hljs-selector-attr),
	:global(html:not(.dark) .hljs-container .hljs-selector-class),
	:global(html:not(.dark) .hljs-container .hljs-selector-id) {
		color: #0550ae;
	}

	/* Strings - prettylights-syntax-string */
	:global(html:not(.dark) .hljs-container .hljs-regexp),
	:global(html:not(.dark) .hljs-container .hljs-string),
	:global(html:not(.dark) .hljs-container .hljs-meta .hljs-string) {
		color: #0a3069;
	}

	/* Variables - prettylights-syntax-variable */
	:global(html:not(.dark) .hljs-container .hljs-built_in),
	:global(html:not(.dark) .hljs-container .hljs-symbol) {
		color: #953800;
	}

	/* Comments - prettylights-syntax-comment */
	:global(html:not(.dark) .hljs-container .hljs-comment),
	:global(html:not(.dark) .hljs-container .hljs-code),
	:global(html:not(.dark) .hljs-container .hljs-formula) {
		color: #6e7781;
	}

	/* Entity tags - prettylights-syntax-entity-tag */
	:global(html:not(.dark) .hljs-container .hljs-name),
	:global(html:not(.dark) .hljs-container .hljs-quote),
	:global(html:not(.dark) .hljs-container .hljs-selector-tag),
	:global(html:not(.dark) .hljs-container .hljs-selector-pseudo) {
		color: #116329;
	}

	/* Storage modifier import */
	:global(html:not(.dark) .hljs-container .hljs-subst) {
		color: #24292f;
	}

	/* Markup heading */
	:global(html:not(.dark) .hljs-container .hljs-section) {
		color: #0969da;
		font-weight: bold;
	}

	/* Markup list */
	:global(html:not(.dark) .hljs-container .hljs-bullet) {
		color: #9a6700;
	}

	/* Markup italic */
	:global(html:not(.dark) .hljs-container .hljs-emphasis) {
		color: #24292f;
		font-style: italic;
	}

	/* Markup bold */
	:global(html:not(.dark) .hljs-container .hljs-strong) {
		color: #24292f;
		font-weight: bold;
	}

	/* Markup inserted */
	:global(html:not(.dark) .hljs-container .hljs-addition) {
		color: #116329;
		background-color: #dafbe1;
	}

	/* Markup deleted */
	:global(html:not(.dark) .hljs-container .hljs-deletion) {
		color: #82071e;
		background-color: #ffebe9;
	}

	/* Note: .hljs-char.escape_, .hljs-link, .hljs-params, .hljs-property, .hljs-punctuation, .hljs-tag are purposely not styled - they inherit base text color */

	/* ============================================ */
	/* DARK MODE SYNTAX HIGHLIGHTING (GitHub Dark) */
	/* ============================================ */
	:global(html.dark .hljs-container .hljs) {
		color: #c9d1d9;
	}

	/* Keywords - prettylights-syntax-keyword */
	:global(html.dark .hljs-container .hljs-doctag),
	:global(html.dark .hljs-container .hljs-keyword),
	:global(html.dark .hljs-container .hljs-meta .hljs-keyword),
	:global(html.dark .hljs-container .hljs-template-tag),
	:global(html.dark .hljs-container .hljs-template-variable),
	:global(html.dark .hljs-container .hljs-type),
	:global(html.dark .hljs-container .hljs-variable.language_) {
		color: #ff7b72;
	}

	/* Entity - prettylights-syntax-entity */
	:global(html.dark .hljs-container .hljs-title),
	:global(html.dark .hljs-container .hljs-title.class_),
	:global(html.dark .hljs-container .hljs-title.class_.inherited__),
	:global(html.dark .hljs-container .hljs-title.function_) {
		color: #d2a8ff;
	}

	/* Constants - prettylights-syntax-constant */
	:global(html.dark .hljs-container .hljs-attr),
	:global(html.dark .hljs-container .hljs-attribute),
	:global(html.dark .hljs-container .hljs-literal),
	:global(html.dark .hljs-container .hljs-meta),
	:global(html.dark .hljs-container .hljs-number),
	:global(html.dark .hljs-container .hljs-operator),
	:global(html.dark .hljs-container .hljs-variable),
	:global(html.dark .hljs-container .hljs-selector-attr),
	:global(html.dark .hljs-container .hljs-selector-class),
	:global(html.dark .hljs-container .hljs-selector-id) {
		color: #79c0ff;
	}

	/* Strings - prettylights-syntax-string */
	:global(html.dark .hljs-container .hljs-regexp),
	:global(html.dark .hljs-container .hljs-string),
	:global(html.dark .hljs-container .hljs-meta .hljs-string) {
		color: #a5d6ff;
	}

	/* Variables - prettylights-syntax-variable */
	:global(html.dark .hljs-container .hljs-built_in),
	:global(html.dark .hljs-container .hljs-symbol) {
		color: #ffa657;
	}

	/* Comments - prettylights-syntax-comment */
	:global(html.dark .hljs-container .hljs-comment),
	:global(html.dark .hljs-container .hljs-code),
	:global(html.dark .hljs-container .hljs-formula) {
		color: #8b949e;
	}

	/* Entity tags - prettylights-syntax-entity-tag */
	:global(html.dark .hljs-container .hljs-name),
	:global(html.dark .hljs-container .hljs-quote),
	:global(html.dark .hljs-container .hljs-selector-tag),
	:global(html.dark .hljs-container .hljs-selector-pseudo) {
		color: #7ee787;
	}

	/* Storage modifier import */
	:global(html.dark .hljs-container .hljs-subst) {
		color: #c9d1d9;
	}

	/* Markup heading */
	:global(html.dark .hljs-container .hljs-section) {
		color: #1f6feb;
		font-weight: bold;
	}

	/* Markup list */
	:global(html.dark .hljs-container .hljs-bullet) {
		color: #f2cc60;
	}

	/* Markup italic */
	:global(html.dark .hljs-container .hljs-emphasis) {
		color: #c9d1d9;
		font-style: italic;
	}

	/* Markup bold */
	:global(html.dark .hljs-container .hljs-strong) {
		color: #c9d1d9;
		font-weight: bold;
	}

	/* Markup inserted */
	:global(html.dark .hljs-container .hljs-addition) {
		color: #aff5b4;
		background-color: #033a16;
	}

	/* Markup deleted */
	:global(html.dark .hljs-container .hljs-deletion) {
		color: #ffdcd7;
		background-color: #67060c;
	}

	/* Note: .hljs-char.escape_, .hljs-link, .hljs-params, .hljs-property, .hljs-punctuation, .hljs-tag are purposely not styled - they inherit base text color */

	/* Responsive adjustments */
	@media (max-width: 768px) {
		:global(.hljs-container) {
			font-size: 1rem !important;
		}

		:global(.hljs-container pre) {
			padding: 0.75rem !important;
			padding-top: 0.5rem !important;
		}
	}
</style>
