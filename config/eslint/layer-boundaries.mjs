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
/** Test-only `./testing` entry points of the apps (standards/01, test entry points). */
export const TEST_ONLY = ['@caa/*/testing'];
/** Every production source file; test files re-enable these imports in eslint.config.mjs. */
export const PRODUCTION_SOURCES = ['apps/*/src/**', 'packages/*/src/**'];

/** Deployable apps; no workspace imports another app, by name or by subpath. */
const APPS = ['api', 'web', 'worker'];

/**
 * Lists the import patterns for every app except the one doing the importing.
 *
 * @param {string} [self] - The importing app's folder name, if it is an app.
 * @returns {string[]} The bare package names and their subpaths.
 */
export function otherApps(self) {
  return APPS.filter((app) => app !== self).flatMap((app) => [`@caa/${app}`, `@caa/${app}/*`]);
}

/** The restriction every production file carries, whichever boundary block matches it last. */
const TEST_ONLY_RESTRICTION = {
  group: TEST_ONLY,
  message: 'The ./testing entry points are for tests only (tests/** and *.test.ts files).',
};

/**
 * Builds a no-restricted-imports rule entry from package names and path patterns. The entry
 * always forbids the test-only entry points as well, because a later flat-config block replaces
 * the whole rule for the files it matches.
 *
 * @param {string[]} names - Import specifiers or globs to forbid.
 * @param {string} message - Explanation shown to the developer.
 * @returns {import('eslint').Linter.RuleEntry} The rule entry.
 */
export function forbid(names, message) {
  return ['error', { patterns: [{ group: names, message }, TEST_ONLY_RESTRICTION] }];
}

/** Import restrictions for every backend package and layer. */
export const layerBoundaries = [
  {
    files: PRODUCTION_SOURCES,
    rules: { 'no-restricted-imports': ['error', { patterns: [TEST_ONLY_RESTRICTION] }] },
  },
  {
    files: ['apps/api/src/**'],
    rules: {
      'no-restricted-imports': forbid(otherApps('api'), 'The API does not import other apps.'),
    },
  },
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
        ['@caa/db', '@caa/engine', 'drizzle-orm', 'pg', '**/*.repository', ...otherApps('api')],
        'Controllers call services only.',
      ),
    },
  },
  {
    files: ['apps/api/src/**/*.service.ts'],
    rules: {
      'no-restricted-imports': forbid(
        ['fastify', '**/*.controller', '**/*.routes', 'drizzle-orm', 'pg', ...otherApps('api')],
        'Services have no HTTP or SQL; use repositories.',
      ),
    },
  },
  {
    files: ['apps/api/src/**/*.routes.ts'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/db', '@caa/engine', '**/*.service', ...otherApps('api')],
        'Routes only wire paths to controllers.',
      ),
    },
  },
  {
    files: ['packages/test-kit/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/db', ...otherApps(), ...FRAMEWORKS],
        'test-kit builds synthetic domain data only; it must not depend on db, apps, or frameworks.',
      ),
    },
  },
  {
    files: ['apps/worker/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/api-contract', ...otherApps('worker'), ...FRAMEWORKS],
        'The worker has no HTTP or UI code and does not import other apps.',
      ),
    },
  },
];
