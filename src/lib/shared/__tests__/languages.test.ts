import { describe, expect, it } from 'vitest';
import {
	LANGUAGE_EXTENSION_MAP,
	LANGUAGE_MAP,
	SUPPORTED_LANGUAGES,
	type SupportedLanguage,
	SupportedLanguageSchema,
	getFileExtension,
	getLanguageDisplayName,
} from '../languages';

describe('languages.ts', () => {
	describe('LANGUAGE_MAP', () => {
		it('should be defined and contain language entries', () => {
			expect(LANGUAGE_MAP).toBeDefined();
			expect(Object.keys(LANGUAGE_MAP).length).toBeGreaterThan(0);
		});

		it('should contain common programming languages', () => {
			expect(LANGUAGE_MAP.javascript).toBe('JavaScript');
			expect(LANGUAGE_MAP.typescript).toBe('TypeScript');
			expect(LANGUAGE_MAP.python).toBe('Python');
			expect(LANGUAGE_MAP.rust).toBe('Rust');
		});

		it('should contain web languages', () => {
			expect(LANGUAGE_MAP.html).toBe('HTML');
			expect(LANGUAGE_MAP.css).toBe('CSS');
			expect(LANGUAGE_MAP.svelte).toBe('Svelte');
			expect(LANGUAGE_MAP.vue).toBe('Vue');
		});
	});

	describe('SUPPORTED_LANGUAGES', () => {
		it('should be defined and contain all language keys', () => {
			expect(SUPPORTED_LANGUAGES).toBeDefined();
			expect(SUPPORTED_LANGUAGES.length).toBe(Object.keys(LANGUAGE_MAP).length);
		});

		it('should match LANGUAGE_MAP keys', () => {
			const languageKeys = Object.keys(LANGUAGE_MAP);
			expect([...SUPPORTED_LANGUAGES]).toEqual(languageKeys);
		});
	});

	describe('SupportedLanguageSchema', () => {
		it('should validate valid language IDs', () => {
			const validLanguages: SupportedLanguage[] = ['javascript', 'python', 'typescript', 'rust'];

			validLanguages.forEach((lang) => {
				expect(() => SupportedLanguageSchema.parse(lang)).not.toThrow();
			});
		});

		it('should reject invalid language IDs', () => {
			const invalidLanguages = ['invalid', 'foobar', '123', ''];

			invalidLanguages.forEach((lang) => {
				expect(() => SupportedLanguageSchema.parse(lang)).toThrow();
			});
		});
	});

	describe('getLanguageDisplayName', () => {
		it('should return correct display name for valid language IDs', () => {
			expect(getLanguageDisplayName('javascript')).toBe('JavaScript');
			expect(getLanguageDisplayName('typescript')).toBe('TypeScript');
			expect(getLanguageDisplayName('python')).toBe('Python');
			expect(getLanguageDisplayName('rust')).toBe('Rust');
			expect(getLanguageDisplayName('html')).toBe('HTML');
			expect(getLanguageDisplayName('css')).toBe('CSS');
		});

		it('should return original string for unknown language IDs', () => {
			expect(getLanguageDisplayName('unknown')).toBe('unknown');
			expect(getLanguageDisplayName('foobar')).toBe('foobar');
			expect(getLanguageDisplayName('invalid-lang')).toBe('invalid-lang');
		});

		it('should handle edge cases', () => {
			expect(getLanguageDisplayName('')).toBe('');
			expect(getLanguageDisplayName('123')).toBe('123');
		});

		it('should work with all supported languages', () => {
			SUPPORTED_LANGUAGES.forEach((lang) => {
				const displayName = getLanguageDisplayName(lang);
				expect(displayName).toBeDefined();
				expect(displayName).toBe(LANGUAGE_MAP[lang]);
			});
		});

		it('should handle case sensitivity', () => {
			// function expects exact match, so uppercase should return original
			expect(getLanguageDisplayName('JAVASCRIPT')).toBe('JAVASCRIPT');
			expect(getLanguageDisplayName('JavaScript')).toBe('JavaScript');
		});

		it('should handle special characters in language IDs', () => {
			expect(getLanguageDisplayName('angular-html')).toBe('Angular HTML');
			expect(getLanguageDisplayName('angular-ts')).toBe('Angular TypeScript');
			expect(getLanguageDisplayName('php-html')).toBe('PHP HTML');
		});
	});

	describe('LANGUAGE_EXTENSION_MAP', () => {
		it('should be defined and contain all supported languages', () => {
			expect(LANGUAGE_EXTENSION_MAP).toBeDefined();
			expect(Object.keys(LANGUAGE_EXTENSION_MAP).length).toBe(SUPPORTED_LANGUAGES.length);
		});

		it('should have extensions starting with a dot', () => {
			Object.values(LANGUAGE_EXTENSION_MAP).forEach((ext) => {
				expect(ext).toMatch(/^\./);
			});
		});

		it('should contain correct extensions for common languages', () => {
			expect(LANGUAGE_EXTENSION_MAP.javascript).toBe('.js');
			expect(LANGUAGE_EXTENSION_MAP.typescript).toBe('.ts');
			expect(LANGUAGE_EXTENSION_MAP.python).toBe('.py');
			expect(LANGUAGE_EXTENSION_MAP.rust).toBe('.rs');
			expect(LANGUAGE_EXTENSION_MAP.go).toBe('.go');
			expect(LANGUAGE_EXTENSION_MAP.java).toBe('.java');
		});

		it('should contain correct extensions for web languages', () => {
			expect(LANGUAGE_EXTENSION_MAP.html).toBe('.html');
			expect(LANGUAGE_EXTENSION_MAP.css).toBe('.css');
			expect(LANGUAGE_EXTENSION_MAP.svelte).toBe('.svelte');
			expect(LANGUAGE_EXTENSION_MAP.vue).toBe('.vue');
			expect(LANGUAGE_EXTENSION_MAP.jsx).toBe('.jsx');
			expect(LANGUAGE_EXTENSION_MAP.tsx).toBe('.tsx');
		});

		it('should contain plaintext as .txt', () => {
			expect(LANGUAGE_EXTENSION_MAP.plaintext).toBe('.txt');
		});
	});

	describe('getFileExtension', () => {
		it('should return correct file extension for valid language IDs', () => {
			expect(getFileExtension('javascript')).toBe('.js');
			expect(getFileExtension('typescript')).toBe('.ts');
			expect(getFileExtension('python')).toBe('.py');
			expect(getFileExtension('rust')).toBe('.rs');
			expect(getFileExtension('html')).toBe('.html');
			expect(getFileExtension('css')).toBe('.css');
		});

		it('should return .txt for unknown language IDs', () => {
			expect(getFileExtension('unknown')).toBe('.txt');
			expect(getFileExtension('foobar')).toBe('.txt');
			expect(getFileExtension('invalid-lang')).toBe('.txt');
		});

		it('should return .txt for empty string', () => {
			expect(getFileExtension('')).toBe('.txt');
		});

		it('should work with all supported languages', () => {
			SUPPORTED_LANGUAGES.forEach((lang) => {
				const extension = getFileExtension(lang);
				expect(extension).toBeDefined();
				expect(extension).toBe(LANGUAGE_EXTENSION_MAP[lang]);
				expect(extension).toMatch(/^\./);
			});
		});

		it('should handle case sensitivity', () => {
			// function expects exact match, so uppercase should return default
			expect(getFileExtension('JAVASCRIPT')).toBe('.txt');
			expect(getFileExtension('JavaScript')).toBe('.txt');
		});

		it('should handle special language IDs correctly', () => {
			expect(getFileExtension('angular-html')).toBe('.html');
			expect(getFileExtension('angular-ts')).toBe('.ts');
			expect(getFileExtension('php-html')).toBe('.php');
			expect(getFileExtension('blade')).toBe('.blade.php');
		});

		it('should handle config file extensions', () => {
			expect(getFileExtension('dockerfile')).toBe('.dockerfile');
			expect(getFileExtension('makefile')).toBe('.makefile');
			expect(getFileExtension('nginx')).toBe('.conf');
			expect(getFileExtension('apache')).toBe('.conf');
		});

		it('should handle data format extensions', () => {
			expect(getFileExtension('json')).toBe('.json');
			expect(getFileExtension('xml')).toBe('.xml');
			expect(getFileExtension('yaml')).toBe('.yaml');
			expect(getFileExtension('toml')).toBe('.toml');
			expect(getFileExtension('csv')).toBe('.csv');
		});
	});

	describe('integration tests', () => {
		it('should maintain consistency between LANGUAGE_MAP and LANGUAGE_EXTENSION_MAP', () => {
			const languageKeys = Object.keys(LANGUAGE_MAP);
			const extensionKeys = Object.keys(LANGUAGE_EXTENSION_MAP);

			expect(languageKeys.sort()).toEqual(extensionKeys.sort());
		});

		it('should have all LANGUAGE_MAP keys in SUPPORTED_LANGUAGES', () => {
			Object.keys(LANGUAGE_MAP).forEach((key) => {
				expect(SUPPORTED_LANGUAGES).toContain(key);
			});
		});

		it('should return consistent results for the same language', () => {
			const testLanguages: SupportedLanguage[] = [
				'javascript',
				'typescript',
				'python',
				'rust',
				'svelte',
			];

			testLanguages.forEach((lang) => {
				// multiple calls should return same result
				expect(getLanguageDisplayName(lang)).toBe(getLanguageDisplayName(lang));
				expect(getFileExtension(lang)).toBe(getFileExtension(lang));

				// display name should match the map
				expect(getLanguageDisplayName(lang)).toBe(LANGUAGE_MAP[lang]);

				// extension should match the map
				expect(getFileExtension(lang)).toBe(LANGUAGE_EXTENSION_MAP[lang]);
			});
		});
	});
});
