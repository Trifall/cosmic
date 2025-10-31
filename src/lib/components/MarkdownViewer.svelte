<script lang="ts">
	import DOMPurify from 'isomorphic-dompurify';
	import { marked } from 'marked';

	let { content, class: className = '' }: { content: string; class?: string } = $props();

	marked.setOptions({
		breaks: true, // support github-style line breaks
		gfm: true, // github flavored markdown
	});

	// parse and sanitize markdown
	const renderedHtml = $derived.by(() => {
		try {
			// parse markdown to HTML
			const rawHtml = marked.parse(content) as string;

			// sanitize HTML to prevent XSS
			const sanitized = DOMPurify.sanitize(rawHtml, {
				// allow common safe tags
				ALLOWED_TAGS: [
					'h1',
					'h2',
					'h3',
					'h4',
					'h5',
					'h6',
					'p',
					'br',
					'strong',
					'em',
					'u',
					's',
					'code',
					'pre',
					'a',
					'ul',
					'ol',
					'li',
					'blockquote',
					'img',
					'table',
					'thead',
					'tbody',
					'tr',
					'th',
					'td',
					'hr',
					'div',
					'span',
					'del',
					'sup',
					'sub',
				],
				// allow safe attributes
				ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'id', 'rel', 'target'],
				// enforce safe protocols for links and images
				ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
			});

			return sanitized;
		} catch (error) {
			console.error('Error rendering markdown:', error);
			return '<p class="text-red-500">Error rendering markdown content</p>';
		}
	});
</script>

<article
	class="markdown-content prose prose-slate mx-auto max-w-none dark:prose-invert {className}"
	style="
		--tw-prose-body: hsl(var(--foreground));
		--tw-prose-headings: hsl(var(--foreground));
		--tw-prose-links: hsl(var(--primary));
		--tw-prose-bold: hsl(var(--foreground));
		--tw-prose-code: hsl(var(--foreground));
		--tw-prose-pre-bg: hsl(var(--muted));
		--tw-prose-pre-code: hsl(var(--foreground));
		--tw-prose-th-borders: hsl(var(--border));
		--tw-prose-td-borders: hsl(var(--border));
		--tw-prose-quotes: hsl(var(--muted-foreground));
		--tw-prose-quote-borders: hsl(var(--border));
		--tw-prose-hr: hsl(var(--border));
	"
>
	<!-- HTML is sanitized with DOMPurify before rendering -->
	<!-- eslint-disable svelte/no-at-html-tags -->
	{@html renderedHtml}
	<!-- eslint-enable svelte/no-at-html-tags -->
</article>

<style>
	.markdown-content :global(pre) {
		width: fit-content;
		max-width: 100%;
		min-width: min-content;
	}
</style>
