/**
 * @file Import rules for root `scripts/**`: only the workspace edges ADR-0016 Amendment 1 sanctions.
 * @module config/eslint/scripts
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 * @see docs/standards/01-repository-structure.md
 */
import { SDK_RESTRICTION } from './layer-boundaries.mjs';

const BASE_MESSAGE =
  'scripts/ may import only the @caa/api-contract and @caa/db root entries (ADR-0016 Amendment 1, issue #617).';
const TEST_MESSAGE =
  'scripts tests may import only the @caa/api-contract and @caa/db root entries and @caa/db/testing (ADR-0016 Amendment 1, issue #617).';
/** Relative or deep paths into `apps/` or `packages/` are never allowed. */
const DEEP_PATH = {
  regex: '(^|/)(apps|packages)/',
  message: 'scripts/ must not reach into apps/ or packages/ by path (ADR-0016 Amendment 1).',
};

/**
 * Builds the rule entry for a set of allowed `@caa/*` specifiers.
 *
 * @param {string} allowed - Regex alternation of the exact specifiers allowed.
 * @param {string} message - Why everything else is blocked.
 * @returns {import('eslint').Linter.RuleEntry} A `no-restricted-imports` entry.
 */
function scriptImports(allowed, message) {
  return [
    'error',
    { patterns: [{ regex: `^@caa/(?!(${allowed})$)`, message }, DEEP_PATH, SDK_RESTRICTION] },
  ];
}

/** Flat-config blocks for `scripts/**`; they must follow the generic test-file blocks. */
export const scriptsRules = [
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-restricted-imports': scriptImports('api-contract|db', BASE_MESSAGE) },
  },
  {
    files: ['scripts/**/*.test.mjs'],
    rules: {
      'no-restricted-imports': scriptImports('api-contract|db|db/testing', TEST_MESSAGE),
    },
  },
];
