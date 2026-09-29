/**
 * @file Lints small code snippets with the rules the repository config gives a file path, so
 * the lint-config tests can check import and syntax boundaries without real source files. Rules
 * that need type information run against an in-memory TypeScript program.
 * @module config/eslint/lint-test-harness
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint, Linter } from 'eslint';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * `beforeAll` timeout, in ms, for {@link loadRepoLintConfig}.
 * NOTE: nearly all of the load is importing the lint plugins the config names (typescript-eslint
 * alone is about half); resolving the config is about 60 ms, and no TypeScript program is built.
 * That import is inherent: these tests check the real config. It takes under a second on a local
 * disk but minutes on WSL `/mnt/c`, where every small file read crosses the file-system bridge,
 * and a full `pnpm verify` runs every workspace's imports at once. The `config` project shares
 * one worker so this cost is paid once per run (vitest.config.ts).
 */
export const LINT_CONFIG_LOAD_TIMEOUT_MS = 300_000;

/** @type {ESLint | undefined} */
let eslint;
/** @type {Promise<void> | undefined} */
let loading;

/**
 * Loads the repository config once per worker; later and concurrent calls share the first load.
 * The first lookup imports every lint plugin, so call this from a `beforeAll` with
 * {@link LINT_CONFIG_LOAD_TIMEOUT_MS}.
 *
 * @returns {Promise<void>} Resolves when the config is ready.
 */
export function loadRepoLintConfig() {
  if (loading === undefined) {
    const instance = new ESLint({ cwd: ROOT });
    loading = instance.calculateConfigForFile('eslint.config.mjs').then(() => {
      eslint = instance;
    });
    // NOTE: a failed load is not cached, so the next beforeAll retries instead of failing fast.
    loading.catch(() => {
      loading = undefined;
    });
  }
  return loading;
}

/** Compiler options for the in-memory program behind {@link lintWithTypes}. */
const SNIPPET_COMPILER_OPTIONS = {
  target: ts.ScriptTarget.ES2023,
  lib: ['lib.es2023.d.ts'],
  types: [],
  strict: true,
  noEmit: true,
};

/**
 * Builds a TypeScript program whose only root file is the snippet, served from memory at the
 * given path, so type-aware rules can run without writing a source file.
 *
 * @param {string} fileName - Absolute path the snippet pretends to live at.
 * @param {string} code - The snippet source.
 * @returns {import('typescript').Program} The program.
 */
function snippetProgram(fileName, code) {
  const host = ts.createCompilerHost(SNIPPET_COMPILER_OPTIONS, true);
  const { fileExists, getSourceFile, readFile } = host;
  host.fileExists = (name) => name === fileName || fileExists(name);
  host.readFile = (name) => (name === fileName ? code : readFile(name));
  host.getSourceFile = (name, languageVersion, ...rest) =>
    name === fileName
      ? ts.createSourceFile(name, code, languageVersion, true)
      : getSourceFile(name, languageVersion, ...rest);
  return ts.createProgram([fileName], SNIPPET_COMPILER_OPTIONS, host);
}

/**
 * Lints a snippet with the selected rules the repository config gives its path.
 *
 * @param {string} path - Repository-relative file path whose config applies.
 * @param {string} code - Source to lint.
 * @param {{ ruleNames: string[], isTyped: boolean }} options - Rules to run, and whether to give
 *   the parser an in-memory program so type-aware rules can run.
 * @returns {Promise<string[]>} Reported messages; empty when the code is allowed.
 */
async function lintSnippet(path, code, { ruleNames, isTyped }) {
  if (eslint === undefined) {
    throw new Error('Call loadRepoLintConfig() in beforeAll first.');
  }
  const config = await eslint.calculateConfigForFile(path);
  const rules = Object.fromEntries(
    ruleNames.flatMap((name) => (config.rules?.[name] ? [[name, config.rules[name]]] : [])),
  );
  const fileName = join(ROOT, path).replaceAll('\\', '/');
  const parserOptions = isTyped ? { programs: [snippetProgram(fileName, code)] } : {};
  const linter = new Linter({ configType: 'flat', cwd: ROOT });
  const results = linter.verify(
    code,
    [
      {
        files: ['**/*.{ts,tsx,mjs}'],
        plugins: config.plugins,
        languageOptions: { parser: config.languageOptions?.parser, parserOptions },
        rules,
      },
    ],
    { filename: fileName },
  );
  return results.map((result) => result.message);
}

/**
 * Lints code with selected rules, configured as the repository config configures them for a
 * path. The TypeScript parser is used without type information, so `import type` parses.
 *
 * @param {string} path - Repository-relative file path whose config applies.
 * @param {string} code - Source to lint.
 * @param {string[]} ruleNames - Rules to run; rules the path doesn't configure are skipped.
 * @returns {Promise<string[]>} Reported messages; empty when the code is allowed.
 */
export function lintWithRules(path, code, ruleNames) {
  return lintSnippet(path, code, { ruleNames, isTyped: false });
}

/**
 * Like {@link lintWithRules}, but type-checks the snippet as a standalone strict ES2023 module
 * first, so rules that need type information, such as
 * `@typescript-eslint/require-array-sort-compare`, can run. The snippet can't import anything.
 *
 * @param {string} path - Repository-relative file path whose config applies.
 * @param {string} code - Self-contained source to lint.
 * @param {string[]} ruleNames - Rules to run; rules the path doesn't configure are skipped.
 * @returns {Promise<string[]>} Reported messages; empty when the code is allowed.
 */
export function lintWithTypes(path, code, ruleNames) {
  return lintSnippet(path, code, { ruleNames, isTyped: true });
}

/**
 * Lints one import with the `no-restricted-imports` entry the repository config gives a path.
 *
 * @param {string} path - Repository-relative file path whose config applies.
 * @param {string} statement - A full import statement, or a bare module specifier, which is
 *   linted as the side-effect import `import '<specifier>';`.
 * @returns {Promise<string[]>} Messages reported for the import; empty when it is allowed.
 */
export function lintImport(path, statement) {
  const code = statement.startsWith('import ') ? statement : `import '${statement}';`;
  return lintWithRules(path, code, ['no-restricted-imports']);
}
