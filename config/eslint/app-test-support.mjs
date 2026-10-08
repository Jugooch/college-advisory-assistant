/**
 * @file Lint rules for app test support (`src/testing.ts`, `src/testing/**` in apps/api and
 * apps/worker): it may import `@caa/db/testing`, and production files may not import it.
 * @see docs/standards/01-repository-structure.md
 * @see docs/adr/0009-test-entry-points-allowlist.md
 */

/** Relative imports of an app's `src/testing.ts` or `src/testing/**` (standards/01). */
export const APP_TEST_SUPPORT_RESTRICTION = {
  regex: String.raw`^\.{1,2}/(.*/)?testing(/.*)?$`,
  message:
    'App test support (src/testing.ts, src/testing/**) is for tests only; production files must not import it (standards/01 App test support, ADR-0009 Amendment 1).',
};

/**
 * Builds the block for an app's test support, which may import `@caa/db/testing` but no other
 * `./testing` entry; the app's other boundaries still apply.
 *
 * @param {string} app - The app's folder name.
 * @param {string[]} names - The app's own forbidden import specifiers.
 * @param {string} message - Why those specifiers are forbidden.
 * @returns {object} A flat-config block.
 */
export function testSupport(app, names, message) {
  return {
    files: [`apps/${app}/src/testing.ts`, `apps/${app}/src/testing/**`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: names, message },
            {
              group: ['@caa/*/testing', '!@caa/db/testing'],
              message:
                'App test support may import only @caa/db/testing; apps never import each other (standards/01 App test support).',
            },
          ],
        },
      ],
    },
  };
}

/**
 * Adds restrictions every file carries, such as the model SDK ban, to a test-support block,
 * because its rule replaces the production block's rule.
 *
 * @param {{ rules: Record<string, [string, { patterns: object[] }]> }} block - A `testSupport` result.
 * @param {object[]} extra - Restriction patterns to add.
 * @returns {object} The block with the extra patterns.
 */
export function withBlockPatterns(block, extra) {
  const [severity, options] = block.rules['no-restricted-imports'];
  return {
    ...block,
    rules: { 'no-restricted-imports': [severity, { patterns: [...options.patterns, ...extra] }] },
  };
}
