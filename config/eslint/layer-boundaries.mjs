/**
 * @file Layer boundary rules: which packages and layers may import which.
 * @see docs/standards/01-repository-structure.md
 * @see docs/standards/05-api-design.md
 */

/** Packages that only the API and worker may import. */
export const SERVER_ONLY = [
  '@caa/db',
  '@caa/engine',
  '@caa/assistant',
  'drizzle-orm',
  'drizzle-orm/*',
  'pg',
];
/** Frameworks that must never leak into framework-free packages. */
export const FRAMEWORKS = ['fastify', 'next', 'next/*', 'react', 'react-dom'];

/**
 * Builds a no-restricted-imports rule entry from package names and path patterns.
 *
 * @param {string[]} names - Import specifiers or globs to forbid.
 * @param {string} message - Explanation shown to the developer.
 * @returns {import('eslint').Linter.RuleEntry} The rule entry.
 */
export function forbid(names, message) {
  return ['error', { patterns: [{ group: names, message }] }];
}

/** Import restrictions for every backend package and layer. */
export const layerBoundaries = [
  {
    files: ['packages/domain/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/*', ...FRAMEWORKS, ...SERVER_ONLY],
        'domain depends only on zod.',
      ),
    },
  },
  {
    files: ['packages/engine/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/db', '@caa/api-contract', '@caa/assistant', ...FRAMEWORKS, 'drizzle-orm', 'pg'],
        'engine is pure: it depends only on @caa/domain.',
      ),
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'The engine must be deterministic (NFR-01).',
        },
        { object: 'Date', property: 'now', message: 'Pass the time in as an argument (NFR-01).' },
      ],
    },
  },
  {
    files: ['packages/api-contract/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        [...SERVER_ONLY, ...FRAMEWORKS],
        'contract depends only on @caa/domain and zod.',
      ),
    },
  },
  {
    files: ['packages/db/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/engine', '@caa/api-contract', '@caa/assistant', ...FRAMEWORKS],
        'db depends only on @caa/domain.',
      ),
    },
  },
  {
    files: ['packages/assistant/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/db', 'drizzle-orm', 'pg', ...FRAMEWORKS],
        'assistant reaches data only through injected tool handlers.',
      ),
    },
  },
  {
    files: ['apps/api/src/**/*.controller.ts'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/db', '@caa/engine', 'drizzle-orm', 'pg', '**/*.repository'],
        'Controllers call services only.',
      ),
    },
  },
  {
    files: ['apps/api/src/**/*.service.ts'],
    rules: {
      'no-restricted-imports': forbid(
        ['fastify', '**/*.controller', '**/*.routes', 'drizzle-orm', 'pg'],
        'Services have no HTTP or SQL; use repositories.',
      ),
    },
  },
  {
    files: ['apps/api/src/**/*.routes.ts'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/db', '@caa/engine', '**/*.service'],
        'Routes only wire paths to controllers.',
      ),
    },
  },
  {
    files: ['apps/worker/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/api-contract', ...FRAMEWORKS],
        'The worker has no HTTP or UI code.',
      ),
    },
  },
];
