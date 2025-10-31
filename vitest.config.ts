import { sveltekit } from '@sveltejs/kit/vite';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// Mock SvelteKit modules
		server: {
			deps: {
				inline: [/better-auth/],
			},
		},
		// Set up aliases for SvelteKit's special imports
		alias: {
			$lib: resolve(__dirname, 'src/lib'),
			$types: resolve(__dirname, 'src/types'),
		},
	},
});
