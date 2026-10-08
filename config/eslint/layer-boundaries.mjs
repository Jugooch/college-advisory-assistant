/**
 * @file Layer boundary rules: which packages and layers may import which.
 * @see docs/standards/01-repository-structure.md
 * @see docs/standards/05-api-design.md
 * @see docs/planning/06-system-requirements-and-traceability.md
 */
import { builtinModules } from 'node:module';

import { APP_TEST_SUPPORT_RESTRICTION, testSupport } from './app-test-support.mjs';
import { determinismBans } from './determinism.mjs';

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
 * Test-only `./testing` entry points of the allowlisted workspaces: apps/api, apps/worker and
 * packages/db (standards/01 §Test entry points, ADR-0009). The convention check keeps other
 * workspaces from exporting one; this glob bans them all from production code either way.
 * Exception (ADR-0009 Amendment 1): app test support, `src/testing.ts` and `src/testing/**` in
 * apps/api and apps/worker, may import `@caa/db/testing`, and only that entry.
 */
export const TEST_ONLY = ['@caa/*/testing'];
/** Every production source file; test files re-enable these imports in eslint.config.mjs. */
export const PRODUCTION_SOURCES = ['apps/*/src/**', 'packages/*/src/**'];

/**
 * Bare Node built-in module names (`fs`, `fs/promises`, `crypto`, ...), read from the running Node
 * so the list cannot drift. Prefix-only modules such as `node:test` are covered by NODE_PREFIX.
 */
export const NODE_BUILTINS = builtinModules.filter((name) => !name.startsWith('node:'));
/** Matches every `node:`-prefixed import specifier. */
const NODE_PREFIX = '^node:';
/** Why the engine may not import Node built-ins. */
const NODE_BUILTIN_MESSAGE =
  'engine is pure (NFR-01): no Node built-ins, so no I/O, clock, or randomness.';
/** Why domain production code may not import Node built-ins. */
const DOMAIN_NODE_BUILTIN_MESSAGE =
  'domain invariants are pure (ADR-0005, NFR-01): no Node built-ins, so no I/O, clock, or randomness.';
/** Why an api `.logic.ts` file may not import Node built-ins. */
const LOGIC_NODE_BUILTIN_MESSAGE =
  '.logic.ts is pure (ADR-0008): no Node built-ins, so no I/O, clock, or randomness.';

/** Syntax banned in every file (standards/02 and /04); blocks that add bans must repeat these. */
export const LANGUAGE_SYNTAX_BANS = [
  {
    selector: 'TSEnumDeclaration',
    message: 'Use an `as const` object plus z.enum (standards/04).',
  },
  { selector: 'ExportDefaultDeclaration', message: 'Use named exports (standards/02).' },
];

/**
 * Clock, timer, randomness, locale, environment, and unordered-sort bans for the engine and the
 * domain's shared invariants (standards/01 §Determinism in pure code, NFR-01, ADR-0005).
 */
const DETERMINISM_BANS = determinismBans(
  LANGUAGE_SYNTAX_BANS,
  'new Date() reads the clock; pass the time in as an argument (NFR-01).',
);

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

/** The only folder that may import the Anthropic SDK (ADR-0015 §9). */
export const SDK_ADAPTER_FILES = 'apps/api/src/adapters/**';
/** The restriction every non-adapter file carries: the model SDK stays behind the adapter port. */
export const SDK_RESTRICTION = {
  group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*'],
  message: 'Import @anthropic-ai/sdk only under apps/api/src/adapters/ (ADR-0015 §9).',
};

/**
 * Adds pattern entries, such as `importNamePattern` or `regex` restrictions, to a rule entry
 * built by `forbid`.
 *
 * @param {import('eslint').Linter.RuleEntry} entry - A `forbid` result.
 * @param {object[]} extra - Additional `patterns` entries, each with its own message.
 * @returns {import('eslint').Linter.RuleEntry} The combined rule entry.
 */
export function withPatterns(entry, extra) {
  const [severity, options] = entry;
  return [severity, { ...options, patterns: [...options.patterns, ...extra] }];
}

/**
 * Builds a `@typescript-eslint/no-restricted-imports` entry that allows only type imports
 * (`import type` or all-`type` specifiers) from the given modules. Core `no-restricted-imports`
 * can't tell type imports from value imports, so this runs beside it.
 *
 * @param {string[]} names - Import specifiers or globs that may provide types only.
 * @param {string} message - Explanation shown to the developer.
 * @returns {import('eslint').Linter.RuleEntry} The rule entry.
 */
export function typesOnly(names, message) {
  return ['error', { patterns: [{ group: names, allowTypeImports: true, message }] }];
}

/**
 * Builds a no-restricted-imports rule entry from package names and path patterns. The entry
 * always forbids the test-only entry points as well, because a later flat-config block replaces
 * the whole rule for the files it matches.
 *
 * @param {string[]} names - Import specifiers or globs to forbid.
 * @param {string} message - Explanation shown to the developer.
 * @param {{ paths: string[], regex: string, message: string }} [exact] - Extra specifiers to
 *   forbid by exact name (`paths`) and by regular expression (`regex`), with their own message.
 *   Exact names avoid gitignore-style matching, which would catch `domain` inside `@caa/domain`.
 * @returns {import('eslint').Linter.RuleEntry} The rule entry.
 */
export function forbid(names, message, exact) {
  const patterns = [{ group: names, message }, TEST_ONLY_RESTRICTION, SDK_RESTRICTION];
  if (exact === undefined) {
    return ['error', { patterns }];
  }
  return [
    'error',
    {
      paths: exact.paths.map((name) => ({ name, message: exact.message })),
      patterns: [...patterns, { regex: exact.regex, message: exact.message }],
    },
  ];
}

/**
 * Like `forbid`, for production files in apps/api and apps/worker: also bans importing the app's
 * own test support.
 *
 * @param {Parameters<typeof forbid>} args - The same arguments as `forbid`.
 * @returns {import('eslint').Linter.RuleEntry} The rule entry.
 */
export function appForbid(...args) {
  return withPatterns(forbid(...args), [APP_TEST_SUPPORT_RESTRICTION]);
}

/** Why only the composition root imports `.wiring.ts` files (ADR-0014). */
export const WIRING_MSG = 'Only container.ts imports *.wiring.ts files; no other apps (ADR-0014).';
/** Import pattern for wiring files. */
export const WIRING = '**/*.wiring';

/** Import restrictions for every backend package and layer. */
export const layerBoundaries = [
  {
    files: PRODUCTION_SOURCES,
    rules: {
      'no-restricted-imports': ['error', { patterns: [TEST_ONLY_RESTRICTION, SDK_RESTRICTION] }],
    },
  },
  {
    files: ['apps/api/src/**'],
    rules: {
      'no-restricted-imports': appForbid([WIRING, ...otherApps('api')], WIRING_MSG),
    },
  },
  {
    files: ['packages/domain/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/*', ...FRAMEWORKS, ...SERVER_ONLY],
        'domain depends only on zod.',
        { paths: NODE_BUILTINS, regex: NODE_PREFIX, message: DOMAIN_NODE_BUILTIN_MESSAGE },
      ),
      ...DETERMINISM_BANS,
    },
  },
  {
    files: ['packages/engine/src/**'],
    rules: {
      'no-restricted-imports': forbid(
        ['@caa/db', '@caa/api-contract', '@caa/assistant', ...FRAMEWORKS, 'drizzle-orm', 'pg'],
        'engine is pure: it depends only on @caa/domain.',
        { paths: NODE_BUILTINS, regex: NODE_PREFIX, message: NODE_BUILTIN_MESSAGE },
      ),
      ...DETERMINISM_BANS,
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
    files: ['apps/api/src/**/*.controller.ts'],
    rules: {
      'no-restricted-imports': appForbid(
        [
          '@caa/db',
          '@caa/engine',
          'drizzle-orm',
          'pg',
          WIRING,
          '**/*.repository',
          '**/*.logic',
          ...otherApps('api'),
        ],
        'Controllers call services only.',
      ),
    },
  },
  {
    files: ['apps/api/src/**/*.service.ts'],
    rules: {
      'no-restricted-imports': appForbid(
        [
          'fastify',
          '**/*.controller',
          '**/*.routes',
          WIRING,
          'drizzle-orm',
          'pg',
          ...otherApps('api'),
        ],
        'Services have no HTTP or SQL; use repositories.',
      ),
      '@typescript-eslint/no-restricted-imports': typesOnly(
        ['**/*.service'],
        'Import only types from another service; share pure helpers through .logic.ts and behavior through the injected interface.',
      ),
    },
  },
  {
    files: ['apps/api/src/**/*.routes.ts'],
    rules: {
      'no-restricted-imports': appForbid(
        ['@caa/db', '@caa/engine', '**/*.service', '**/*.logic', WIRING, ...otherApps('api')],
        'Routes only wire paths to controllers.',
      ),
    },
  },
  {
    // SAFETY: logic runs the engine's determinism rules, so identical inputs give identical results.
    files: ['apps/api/src/**/*.logic.ts'],
    rules: {
      'no-restricted-imports': withPatterns(
        appForbid(
          [
            'fastify',
            'drizzle-orm',
            'drizzle-orm/*',
            'pg',
            '@caa/assistant',
            '**/*.service',
            '**/*.controller',
            '**/*.routes',
            '**/*.repository',
            '**/container',
            WIRING,
            '**/config/*',
            '**/plugins/*',
            '**/request-context',
            ...otherApps('api'),
          ],
          'Logic is pure (ADR-0008): no I/O, services, request context, or configuration.',
          { paths: NODE_BUILTINS, regex: NODE_PREFIX, message: LOGIC_NODE_BUILTIN_MESSAGE },
        ),
        [
          {
            group: ['@caa/db'],
            importNamePattern: '^[a-z]',
            message: 'Logic may import only types from @caa/db (ADR-0008).',
          },
        ],
      ),
      '@typescript-eslint/no-restricted-imports': typesOnly(
        ['@caa/api-contract'],
        'Logic may import only types from @caa/api-contract (ADR-0008).',
      ),
      ...determinismBans(
        LANGUAGE_SYNTAX_BANS,
        "Pass the time in from the service's injected clock.",
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
      'no-restricted-imports': appForbid(
        ['@caa/api-contract', ...otherApps('worker'), ...FRAMEWORKS],
        'The worker has no HTTP or UI code and does not import other apps.',
      ),
    },
  },
  testSupport('api', otherApps('api'), 'The API does not import other apps.'),
  testSupport(
    'worker',
    ['@caa/api-contract', ...otherApps('worker'), ...FRAMEWORKS],
    'The worker has no HTTP or UI code and does not import other apps.',
  ),
];
