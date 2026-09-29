/**
 * @file Tests the per-folder web import rules (ADR-0007, standard 06 §Layers) with full import
 * statements, so named-import restrictions on contract and domain exports are exercised.
 * @see docs/standards/06-frontend.md
 * @see docs/adr/0007-web-shared-tier-and-server-actions.md
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  LINT_CONFIG_LOAD_TIMEOUT_MS,
  lintImport,
  lintWithRules,
  loadRepoLintConfig,
} from './lint-test-harness.mjs';

beforeAll(loadRepoLintConfig, LINT_CONFIG_LOAD_TIMEOUT_MS);

/**
 * Builds a named import statement.
 *
 * @param {string} name - Imported binding.
 * @param {string} from - Module specifier.
 * @returns {string} The statement.
 */
const named = (name, from) => `import { ${name} } from '${from}';`;

/** For each web folder: a sample file, imports it may use, and imports it may not. */
const CASES = [
  {
    path: 'apps/web/src/features/course-checks/components/check-evidence.tsx',
    allowed: [
      named('describeReason', '@/shared/utils/reason-code-wording'),
      named('describeLeaf', '../utils/decisive-leaf-wording'),
      named('CheckState', '@caa/domain'),
      named('MAX_COURSE_CHECK_COURSES', '@caa/api-contract'),
      "import type { CheckResult } from '@caa/domain';",
    ],
    rejected: [
      named('describeReason', '@/features/verification-states/utils/reason-code-wording'),
      named('x', '../../academic-summary/utils/y'),
      named('CourseChecksRequestSchema', '@caa/api-contract'),
      named('createCourse', '@caa/domain'),
      "import * as domain from '@caa/domain';",
      named('devSignInAction', '../actions/dev-sign-in.action'),
      named('readSessionToken', '@/lib/session-cookie'),
    ],
  },
  {
    path: 'apps/web/src/features/course-checks/utils/course-check-query.ts',
    allowed: [
      named('CourseChecksRequestSchema', '@caa/api-contract'),
      named('ApiError', '@caa/api-contract'),
      named('z', 'zod'),
      "import type { StatusTone } from '@/components/ui/status-badge';",
      named('formatTimestamp', '@/shared/utils/format-display'),
    ],
    rejected: [
      named('deriveAggregateState', '@caa/domain'),
      named('checkCoursesEndpoint', '@caa/api-contract'),
      named('useState', 'react'),
      named('redirect', 'next/navigation'),
      named('ApiErrorNotice', '@/shared/components/api-error-notice'),
      named('x', '../components/x'),
      named('checkCourses', '@/api/course-checks.api'),
    ],
  },
  {
    path: 'apps/web/src/features/session/actions/dev-sign-in.action.ts',
    allowed: [
      '@/api/session.api',
      '@/lib/session-cookie',
      'next/headers',
      'next/navigation',
      '../utils/dev-sign-in',
      '@/shared/utils/x',
      'zod',
    ],
    rejected: ['../components/dev-sign-in-form', '@/features/academic-summary/utils/x', 'react'],
  },
  {
    path: 'apps/web/src/shared/components/api-error-notice.tsx',
    allowed: [
      '@/shared/utils/error-code-wording',
      '@/components/ui/status-badge',
      named('ErrorCode', '@caa/domain'),
    ],
    rejected: [
      '@/features/session/utils/x',
      '@/api/session.api',
      '@/lib/api-client',
      named('StudentIdSchema', '@caa/domain'),
    ],
  },
  {
    path: 'apps/web/src/shared/utils/format-display.ts',
    allowed: [named('StudentIdSchema', '@caa/domain'), named('ApiError', '@caa/api-contract')],
    rejected: [
      '@/features/x/utils/y',
      'react',
      '@/shared/components/x',
      '../../features/x/utils/y',
    ],
  },
  {
    path: 'apps/web/src/components/ui/status-badge.tsx',
    allowed: ['react', '@/components/ui/other'],
    rejected: [
      "import type { CheckState } from '@caa/domain';",
      '@/shared/utils/x',
      '@/features/x/components/y',
    ],
  },
  {
    path: 'apps/web/src/app/overview/page.tsx',
    allowed: [
      '@/features/x/components/y',
      '@/features/x/utils/y',
      '@/features/session/actions/dev-sign-in.action',
      '@/shared/components/x',
      named('ApiError', '@caa/api-contract'),
    ],
    rejected: [
      '@/lib/api-client',
      named('CourseChecksRequestSchema', '@caa/api-contract'),
      '@/features/x/hooks/use-y',
    ],
  },
  {
    path: 'apps/web/src/lib/session-cookie.ts',
    allowed: ['next/headers', named('createApiClient', '@caa/api-contract')],
    rejected: ['@/features/x/utils/y', '@/shared/utils/y', '@/api/x.api'],
  },
  {
    path: 'apps/web/src/api/session.api.ts',
    allowed: [named('getMeEndpoint', '@caa/api-contract'), '@/lib/api-client'],
    rejected: ['@/shared/utils/x', named('createCourse', '@caa/domain')],
  },
  {
    path: 'apps/web/src/features/x/hooks/use-y.ts',
    allowed: ['@/api/x.api', '@/shared/utils/x', '../utils/y', named('YSchema', '@caa/domain')],
    rejected: [
      '@/lib/api-client',
      '../actions/y.action',
      '../components/z',
      '@/features/z/utils/w',
    ],
  },
];

describe.each(CASES)('web imports in $path', ({ path, allowed, rejected }) => {
  it.each(allowed)('allows %s', async (statement) => {
    expect(await lintImport(path, statement)).toEqual([]);
  });

  it.each(rejected)('forbids %s', async (statement) => {
    expect(await lintImport(path, statement)).not.toEqual([]);
  });
});

describe('web-wide bans stay in every folder block', () => {
  it.each(CASES.map(({ path }) => path))('forbids server-only packages in %s', async (path) => {
    const messages = await lintImport(path, '@caa/db');

    expect(messages.join('\n')).toContain('only through the API');
  });

  it.each(CASES.map(({ path }) => path))('forbids test-only entry points in %s', async (path) => {
    const messages = await lintImport(path, '@caa/api/testing');

    expect(messages.join('\n')).toContain('for tests only');
  });

  it('exempts web test files', async () => {
    const path = 'apps/web/src/features/course-checks/components/check-evidence.test.tsx';

    expect(await lintImport(path, named('createCourse', '@caa/domain'))).toEqual([]);
  });
});

describe('relative paths cannot bypass the folder rules', () => {
  it.each([
    ['apps/web/src/app/overview/page.tsx', named('readSessionToken', '../../lib/session-cookie')],
    [
      'apps/web/src/components/ui/status-badge.tsx',
      named('describeReason', '../../shared/utils/reason-code-wording'),
    ],
    ['apps/web/src/api/session.api.ts', named('x', '../shared/utils/x')],
    ['apps/web/src/api/session.api.ts', named('y', '../features/x/utils/y')],
    ['apps/web/src/lib/session-cookie.ts', named('x', '../shared/utils/x')],
    ['apps/web/src/lib/session-cookie.ts', named('y', '../features/x/utils/y')],
    ['apps/web/src/app/overview/page.tsx', named('x', '../x')],
    ['apps/web/src/features/x/components/y.tsx', named('z', './../../lib/api-client')],
    ['apps/web/src/features/x/components/y.tsx', named('z', '../utils/../../../lib/api-client')],
    ['apps/web/src/features/x/components/y.tsx', named('z', '@/shared/../lib/api-client')],
    ['apps/web/src/shared/utils/x.ts', named('y', '../../lib/api-client')],
    ['apps/web/src/features/x/hooks/use-y.ts', named('z', '../../z/utils/w')],
  ])('forbids %s importing %s', async (path, statement) => {
    expect(await lintImport(path, statement)).not.toEqual([]);
  });

  it.each([
    ['apps/web/src/components/ui/status-badge.tsx', named('x', './other')],
    ['apps/web/src/lib/api-client.ts', named('x', './session-cookie')],
    ['apps/web/src/app/layout.tsx', "import './globals.css';"],
    ['apps/web/src/features/x/components/y.tsx', named('z', '../utils/z')],
    ['apps/web/src/features/x/components/y.tsx', named('z', './z')],
    ['apps/web/src/shared/components/x.tsx', named('y', '../utils/y')],
  ])('allows %s importing %s', async (path, statement) => {
    expect(await lintImport(path, statement)).toEqual([]);
  });
});

describe('folder naming', () => {
  const FOLDER_RULE = ['check-file/folder-naming-convention'];

  it.each([
    'apps/web/src/app/students/[studentId]/page.tsx',
    'apps/web/src/app/(signed-in)/overview/page.tsx',
    'apps/web/src/features/course-checks/components/check-evidence.tsx',
    'apps/api/src/course-checks/course-checks.controller.ts',
    'packages/engine/src/verification/check.ts',
  ])('allows %s', async (path) => {
    expect(await lintWithRules(path, '', FOLDER_RULE)).toEqual([]);
  });

  it.each([
    'apps/web/src/features/[studentId]/x.ts',
    'apps/web/src/app/StudentList/page.tsx',
    'apps/api/src/courseChecks/x.ts',
    'apps/worker/src/[job]/x.ts',
    'packages/domain/src/Course_Models/x.ts',
  ])('forbids %s', async (path) => {
    expect(await lintWithRules(path, '', FOLDER_RULE)).not.toEqual([]);
  });
});
