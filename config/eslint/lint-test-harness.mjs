/**
 * @file Lints small code snippets with the rules the repository config gives a file path, so
 * the lint-config tests can check import and syntax boundaries without real source files.
 * @module config/eslint/lint-test-harness
 */
import { fileURLToPath } from 'node:url';

import { ESLint, Linter } from 'eslint';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** @type {ESLint | undefined} */
let eslint;

/**
 * Loads the repository config once. The first lookup loads every lint plugin, which is slow on
 * some file systems, so call this from a `beforeAll` with a long timeout.
 *
 * @returns {Promise<void>} Resolves when the config is ready.
 */
export async function loadRepoLintConfig() {
  eslint ??= new ESLint({ cwd: ROOT });
  await eslint.calculateConfigForFile('eslint.config.mjs');
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
export async function lintWithRules(path, code, ruleNames) {
  if (eslint === undefined) {
    throw new Error('Call loadRepoLintConfig() in beforeAll first.');
  }
  const config = await eslint.calculateConfigForFile(path);
  const rules = Object.fromEntries(
    ruleNames.flatMap((name) => (config.rules?.[name] ? [[name, config.rules[name]]] : [])),
  );
  const linter = new Linter({ configType: 'flat' });
  const results = linter.verify(
    code,
    [
      {
        files: ['**/*.{ts,tsx,mjs}'],
        plugins: config.plugins,
        languageOptions: { parser: config.languageOptions?.parser },
        rules,
      },
    ],
    { filename: path },
  );
  return results.map((result) => result.message);
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
