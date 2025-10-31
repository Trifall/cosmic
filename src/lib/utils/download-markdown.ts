import { browser } from '$app/environment';
import type { SinglePasteData } from '$src/lib/shared/pastes';
import { sanitizeFilename } from '$src/lib/utils/format';

export const downloadMarkdown = (paste: SinglePasteData) => {
	if (!browser) return;

	if (!paste || !paste.content || paste.content === null || paste.content === undefined) return;

	// extract content as a const to help TypeScript understand it's not null
	const content = paste.content;
	const title = paste.title;
	const customSlug = paste.customSlug;
	const id = paste.id;

	import('marked').then(({ marked }) => {
		import('isomorphic-dompurify').then((DOMPurifyModule) => {
			const DOMPurify = DOMPurifyModule.default;
			const rawHtml = marked.parse(content) as string;
			const sanitized = DOMPurify.sanitize(rawHtml);

			// create full HTML document
			const htmlContent = `<!DOCTYPE html>
																	<html lang="en">
																	<head>
																		<meta charset="UTF-8">
																		<meta name="viewport" content="width=device-width, initial-scale=1.0">
																		<title>${title || 'Markdown Document'}</title>
																		<style>
																			body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; }
																			pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
																			code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; }
																			blockquote { border-left: 4px solid #dfe2e5; margin: 0; padding-left: 1rem; color: #6a737d; }
																			table { border-collapse: collapse; width: 100%; }
																			table td, table th { border: 1px solid #dfe2e5; padding: 6px 13px; }
																			table tr:nth-child(2n) { background-color: #f6f8fa; }
																		</style>
																	</head>
																	<body>
																	${sanitized}
																	</body>
																	</html>`;

			const blob = new Blob([htmlContent], { type: 'text/html' });
			const url = URL.createObjectURL(blob);
			const filename = sanitizeFilename(`${title || customSlug || id}`, '.html', 250);

			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.style.display = 'none';
			document.body.appendChild(a);
			a.click();

			setTimeout(() => {
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}, 100);
		});
	});
};
