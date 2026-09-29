/**
 * @file Rules for the Next.js web app: React, accessibility, and its per-folder import
 * boundaries (ADR-0007). Each folder block replaces `no-restricted-imports` for its files, so
 * `webForbid` repeats the web-wide bans in every block.
 * @see docs/standards/06-frontend.md
 * @see docs/adr/0007-web-shared-tier-and-server-actions.md
 */
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import { forbid, otherApps, SERVER_ONLY, withPatterns } from './layer-boundaries.mjs';

const WEB = 'apps/web/src';

/** W0: domain factories and shared invariants (camelCase) stay out of all web code. */
const DOMAIN_FUNCTIONS = {
  group: ['@caa/domain'],
  importNamePattern: '^[a-z]',
  message: 'Web code never imports domain factories or invariants (standard 04, ADR-0005).',
};
/** W1: contract functions and endpoint definitions belong to src/api and src/lib only. */
const CONTRACT_FUNCTIONS = {
  group: ['@caa/api-contract'],
  importNamePattern: '^[a-z]',
  message: 'Only src/api and src/lib import contract functions and endpoints (ADR-0007).',
};
/** W2: pages and components don't parse; they call a util that does. */
const SCHEMAS = {
  group: ['@caa/domain', '@caa/api-contract'],
  importNamePattern: 'Schema$',
  message: 'Pages and components import no schemas; parse in a util (standard 06 §Layers).',
};
/**
 * A `.` or `..` segment anywhere but the start of a path (`../../x`, `./../x`, `../a/../../x`,
 * `@/shared/../lib/x`). With it banned, a relative import climbs at most one folder. Structure
 * rules put every feature and shared file at least one folder below its feature or `src/shared`,
 * so one `../` can't leave it, and alias paths can't dodge the folder bans.
 */
const DOT_SEGMENTS = {
  regex: String.raw`^(?:\.\.?/(?:.*/)?|[^.].*/)\.\.?(?:/|$)`,
  message:
    'Relative imports climb at most one folder; reach other folders through @/ aliases (ADR-0007).',
};
/** Any `../` import, for folders whose files reach other folders only through @/ aliases. */
const PARENT_RELATIVE = {
  regex: String.raw`^\.\./`,
  message: 'Import other folders through @/ aliases so the folder rules apply (ADR-0007).',
};
/** Frameworks that pure utils and server actions must not pull in. */
const REACT = ['react', 'react-dom'];
const NEXT = ['next', 'next/*'];

/**
 * Builds the web `no-restricted-imports` entry: the web-wide bans (server-only packages,
 * Fastify, other apps, test-only entry points, W0) plus a folder's own restrictions.
 *
 * @param {string[]} extraGroups - Import specifiers or globs this folder may not use.
 * @param {string} message - Why the folder may not use them.
 * @param {object[]} [extraPatterns] - Named-import (W1, W2) or regex restrictions.
 * @returns {import('eslint').Linter.RuleEntry} The rule entry.
 */
function webForbid(extraGroups, message, extraPatterns = []) {
  const folder = extraGroups.length > 0 ? [{ group: extraGroups, message }] : [];
  return withPatterns(
    forbid(
      [...SERVER_ONLY, 'fastify', ...otherApps('web')],
      'The web app reaches data only through the API.',
    ),
    [DOMAIN_FUNCTIONS, DOT_SEGMENTS, ...folder, ...extraPatterns],
  );
}

/**
 * Builds a flat-config block that sets the import rule for one folder.
 *
 * @param {string} folder - Glob under apps/web/src.
 * @param {import('eslint').Linter.RuleEntry} entry - A `webForbid` result.
 * @returns {import('eslint').Linter.Config} The config block.
 */
function folderBlock(folder, entry) {
  return { files: [`${WEB}/${folder}`], rules: { 'no-restricted-imports': entry } };
}

/** Per-folder import rules, one block per row of standard 06 §Layers. */
const folderImportRules = [
  folderBlock(
    'app/**',
    webForbid(['@/lib/*', '@/features/*/hooks/*'], 'Pages use src/api, features, and shared.', [
      CONTRACT_FUNCTIONS,
      SCHEMAS,
      PARENT_RELATIVE,
    ]),
  ),
  folderBlock(
    'features/*/components/**',
    webForbid(
      ['@/api/*', '@/lib/*', '@/features/*', '../actions/*'],
      'Components receive data via props or hooks and never import actions (ADR-0007).',
      [CONTRACT_FUNCTIONS, SCHEMAS],
    ),
  ),
  folderBlock(
    'features/*/hooks/**',
    webForbid(
      ['@/lib/*', '@/features/*', '../actions/*', '../components/*'],
      'Hooks use src/api, shared utils, and their own utils.',
      [CONTRACT_FUNCTIONS],
    ),
  ),
  folderBlock(
    'features/*/utils/**',
    webForbid(
      [
        ...REACT,
        ...NEXT,
        '@/api/*',
        '@/lib/*',
        '@/features/*',
        '@/shared/components/*',
        '../components/*',
        '../hooks/*',
        '../actions/*',
      ],
      'Feature utils are pure helpers: no React, Next, API calls, or UI.',
      [CONTRACT_FUNCTIONS],
    ),
  ),
  folderBlock(
    'features/*/actions/**',
    webForbid(
      [...REACT, '@/features/*', '@/shared/components/*', '../components/*', '../hooks/*'],
      'Server actions use src/api, src/lib, shared utils, and their own utils (ADR-0007).',
      [CONTRACT_FUNCTIONS],
    ),
  ),
  folderBlock(
    'shared/components/**',
    webForbid(
      ['@/api/*', '@/lib/*', '@/features/*'],
      'Shared components know no feature and fetch nothing (ADR-0007).',
      [CONTRACT_FUNCTIONS, SCHEMAS],
    ),
  ),
  folderBlock(
    'shared/utils/**',
    webForbid(
      [
        ...REACT,
        ...NEXT,
        '@/api/*',
        '@/lib/*',
        '@/features/*',
        '@/shared/components/*',
        '../components/*',
      ],
      'Shared utils are pure helpers that know no feature (ADR-0007).',
      [CONTRACT_FUNCTIONS],
    ),
  ),
  folderBlock(
    'components/**',
    webForbid(['@caa/*'], 'components/ui holds generic primitives with no app knowledge.', [
      {
        regex: '^@/(?!components/ui/)',
        message: 'components/ui imports only other components/ui files (ADR-0007).',
      },
      PARENT_RELATIVE,
    ]),
  ),
  folderBlock(
    'api/**',
    webForbid(
      ['@/features/*', '@/shared/*', '@/components/*', ...REACT],
      'src/api holds backend calls only.',
      [PARENT_RELATIVE],
    ),
  ),
  folderBlock(
    'lib/**',
    webForbid(
      ['@/api/*', '@/features/*', '@/shared/*', '@/components/*', ...REACT],
      'src/lib is server infrastructure: the API client and the session cookie.',
      [PARENT_RELATIVE],
    ),
  ),
];

/** Configuration blocks for apps/web. */
export const webRules = [
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      ...jsxA11y.flatConfigs.strict.plugins,
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ...jsxA11y.flatConfigs.strict.languageOptions,
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-restricted-imports': webForbid([], '', [CONTRACT_FUNCTIONS]),
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Call the API through src/api/*.api.ts.' },
      ],
    },
  },
  ...folderImportRules,
];
