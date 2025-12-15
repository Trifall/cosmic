import { defineBaseMetaTags } from 'svelte-meta-tags';
import { getPublicSiteName } from '$src/lib/utils/format';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ url }) => {
	const baseTags = defineBaseMetaTags({
		title: getPublicSiteName(),
		titleTemplate: '%s | ' + getPublicSiteName(),
		description: 'A self-hostable, pastebin-like service',
		canonical: new URL(url.pathname, url.origin).href,
		openGraph: {
			type: 'website',
			url: new URL(url.pathname, url.origin).href,
			title: getPublicSiteName(),
			description: 'A self-hostable, pastebin-like service',
			images: [
				{
					url: new URL('/og_image.png', url.origin).href,
					alt: 'Open Graph image for ' + getPublicSiteName(),
					width: 1200,
					height: 630,
					secureUrl: new URL('/og_image.png', url.origin).href,
					type: 'image/png',
				},
			],
		},
		twitter: {
			cardType: 'summary_large_image',
			title: getPublicSiteName(),
			description: 'A self-hostable, pastebin-like service',
			image: new URL('/og_image.png', url.origin).href,
			imageAlt: 'Twitter image for ' + getPublicSiteName(),
		},
	});

	return { ...baseTags };
};
