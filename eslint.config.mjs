import { includeIgnoreFile } from '@eslint/compat';
import prettier from 'eslint-config-prettier';
import oxlint from 'eslint-plugin-oxlint';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	// Include TypeScript ESLint for rule definitions (oxlint will override them)
	...ts.configs.recommended,
	// oxlint recommended config - disables ESLint rules that oxlint handles
	...oxlint.configs['flat/recommended'],
	// Only use Svelte-specific configs and rules
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
			},
		},
		rules: {
			// Disable TypeScript rules that might conflict with oxlint
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			// Handle consistent-type-imports in ESLint for Svelte files since oxlint has issues with JSX
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{
					prefer: 'type-imports',
					fixStyle: 'separate-type-imports',
				},
			],
		},
	}
);
