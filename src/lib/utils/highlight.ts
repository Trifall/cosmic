import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/src/lib/shared/languages';
import hljs from 'highlight.js/lib/core';
import apache from 'highlight.js/lib/languages/apache';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import clojure from 'highlight.js/lib/languages/clojure';
import cmake from 'highlight.js/lib/languages/cmake';
import cpp from 'highlight.js/lib/languages/cpp';
import crystal from 'highlight.js/lib/languages/crystal';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import dart from 'highlight.js/lib/languages/dart';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import elixir from 'highlight.js/lib/languages/elixir';
import erlang from 'highlight.js/lib/languages/erlang';
import fsharp from 'highlight.js/lib/languages/fsharp';
import go from 'highlight.js/lib/languages/go';
import graphql from 'highlight.js/lib/languages/graphql';
import groovy from 'highlight.js/lib/languages/groovy';
import haskell from 'highlight.js/lib/languages/haskell';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import julia from 'highlight.js/lib/languages/julia';
import kotlin from 'highlight.js/lib/languages/kotlin';
import latex from 'highlight.js/lib/languages/latex';
import less from 'highlight.js/lib/languages/less';
import lua from 'highlight.js/lib/languages/lua';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import matlab from 'highlight.js/lib/languages/matlab';
import nginx from 'highlight.js/lib/languages/nginx';
import ocaml from 'highlight.js/lib/languages/ocaml';
import perl from 'highlight.js/lib/languages/perl';
import php from 'highlight.js/lib/languages/php';
// import only the languages we support (that exist in highlight.js)
import plaintext from 'highlight.js/lib/languages/plaintext';
import powershell from 'highlight.js/lib/languages/powershell';
import protobuf from 'highlight.js/lib/languages/protobuf';
import python from 'highlight.js/lib/languages/python';
import r from 'highlight.js/lib/languages/r';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scala from 'highlight.js/lib/languages/scala';
import scss from 'highlight.js/lib/languages/scss';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import stylus from 'highlight.js/lib/languages/stylus';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import x86asm from 'highlight.js/lib/languages/x86asm';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import svelte from 'highlight.svelte';

// register all supported languages
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('clojure', clojure);
hljs.registerLanguage('haskell', haskell);
hljs.registerLanguage('elixir', elixir);
hljs.registerLanguage('erlang', erlang);
hljs.registerLanguage('dart', dart);
hljs.registerLanguage('julia', julia);
hljs.registerLanguage('lua', lua);
hljs.registerLanguage('perl', perl);
hljs.registerLanguage('r', r);
hljs.registerLanguage('matlab', matlab);
hljs.registerLanguage('groovy', groovy);
hljs.registerLanguage('fsharp', fsharp);
hljs.registerLanguage('ocaml', ocaml);
hljs.registerLanguage('crystal', crystal);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml); // html uses xml
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('less', less);
hljs.registerLanguage('stylus', stylus);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('latex', latex);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('makefile', makefile);
hljs.registerLanguage('cmake', cmake);
hljs.registerLanguage('nginx', nginx);
hljs.registerLanguage('apache', apache);
hljs.registerLanguage('graphql', graphql);
hljs.registerLanguage('protobuf', protobuf);
hljs.registerLanguage('proto', protobuf); // alias
hljs.registerLanguage('x86asm', x86asm);
hljs.registerLanguage('assembly', x86asm); // alias
hljs.registerLanguage('svelte', svelte);

/**
 * ensures all languages are registered with highlight.js
 * can be called multiple times safely (idempotent)
 */
export const ensureLanguagesRegistered = (): void => {
	// languages are already registered at module load time
};

/**
 * detects the language of the provided code using highlight.js
 * returns the detected language name or 'plaintext' as fallback
 */
export const detectLanguage = (code: string): string => {
	// dont attempt detection on empty or very short code
	if (!code || code.trim().length < 10) {
		return 'plaintext';
	}

	try {
		const result = hljs.highlightAuto(code);

		// highlight.js returns a language with a confidence score
		// if confidence is too low or no language detected, fallback to plaintext
		if (!result.language || result.relevance < 5) {
			return 'plaintext';
		}

		// normalize some common highlight.js language names to match our schema
		return normalizeDetectedLanguage(result.language);
	} catch (error) {
		console.warn('Language detection failed:', error);
		return 'plaintext';
	}
};

/**
 * normalizes highlight.js language names to match our supported languages schema
 */
const normalizeDetectedLanguage = (hljsLang: string): string => {
	const normalized = hljsLang.toLowerCase().trim();

	// verify the language is in our supported list
	if (!SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
		return 'plaintext';
	}

	return normalized;
};
