/**
 * @file Tests for the file placement rules, focused on test file suffixes and test entry points.
 */
import { describe, expect, it } from 'vitest';

import { checkStructure } from './structure-rules.mjs';

describe('checkStructure', () => {
  it('accepts a repository integration test beside its repository', () => {
    const problem = checkStructure(
      'packages/db/src/repositories/institution.repository.integration.test.ts',
    );

    expect(problem).toBeNull();
  });

  it('accepts integration tests for api modules and worker jobs', () => {
    const paths = [
      'apps/api/src/modules/health/health.service.integration.test.ts',
      'apps/worker/src/jobs/import-roster.job.integration.test.ts',
    ];

    expect(paths.map(checkStructure)).toEqual([null, null]);
  });

  it('still accepts a plain unit test', () => {
    expect(checkStructure('packages/db/src/mappers/institution.mapper.test.ts')).toBeNull();
  });

  it('rejects an integration suffix without .test', () => {
    const problem = checkStructure(
      'packages/db/src/repositories/institution.repository.integration.ts',
    );

    expect(problem).toContain('*.repository.ts');
  });

  it('rejects integration tests in the pure domain package', () => {
    const problem = checkStructure(
      'packages/domain/src/models/institution.model.integration.test.ts',
    );

    expect(problem).toContain('*.model.ts');
  });

  it('accepts the api test entry point and its test at the src root', () => {
    const paths = ['apps/api/src/testing.ts', 'apps/api/src/testing.test.ts'];

    expect(paths.map(checkStructure)).toEqual([null, null]);
  });

  it('still accepts the worker test entry point at its src root', () => {
    const paths = ['apps/worker/src/testing.ts', 'apps/worker/src/testing.test.ts'];

    expect(paths.map(checkStructure)).toEqual([null, null]);
  });

  it('rejects other files at the api src root', () => {
    const paths = [
      'apps/api/src/helpers.ts',
      'apps/api/src/testing-utils.ts',
      'apps/api/src/testing.integration.test.ts',
    ];

    for (const problem of paths.map(checkStructure)) {
      expect(problem).toContain('testing.ts');
    }
  });

  it('still rejects a nested index.ts under an api testing folder', () => {
    expect(checkStructure('apps/api/src/testing/index.ts')).toContain('no nested index.ts');
  });
});

describe('checkStructure for the web layers and api logic (ADR-0007, ADR-0008)', () => {
  it.each([
    'apps/web/src/features/session/actions/dev-sign-in.action.ts',
    'apps/web/src/features/session/actions/dev-sign-in.action.test.ts',
    'apps/web/src/features/course-checks/utils/course-check-query.ts',
    'apps/web/src/features/course-checks/utils/course-check-query.test.ts',
    'apps/web/src/shared/components/api-error-notice.tsx',
    'apps/web/src/shared/components/api-error-notice.test.tsx',
    'apps/web/src/shared/utils/reason-code-wording.ts',
    'apps/web/src/shared/utils/reason-code-wording.test.ts',
    'apps/web/src/components/ui/status-badge.tsx',
    'apps/web/src/lib/session-cookie.ts',
    'apps/web/src/lib/session-cookie.test.ts',
    'apps/api/src/modules/course-verification/course-verification.logic.ts',
    'apps/api/src/modules/course-verification/course-verification.logic.test.ts',
    'apps/api/src/modules/source-freshness/source-freshness.logic.ts',
    'apps/web/src/features/system-status/components/system-status-card.tsx',
    'apps/web/src/features/x/hooks/use-y.ts',
    'apps/api/src/modules/health/health.service.ts',
  ])('accepts %s', (path) => {
    expect(checkStructure(path)).toBeNull();
  });

  it.each([
    ['apps/web/src/features/session/actions/dev-sign-in.ts', '*.action.ts'],
    ['apps/web/src/features/session/actions/dev-sign-in.action.tsx', '*.action.ts'],
    ['apps/web/src/features/x/utils/wording.tsx', '*.ts (utils have no JSX)'],
    ['apps/web/src/features/x/services/y.ts', 'features/<name>/actions/'],
    ['apps/web/src/features/x/y.ts', 'features/<name>/actions/'],
    ['apps/web/src/shared/hooks/use-x.ts', 'shared/components/*.tsx or shared/utils/*.ts'],
    ['apps/web/src/shared/wording.ts', 'shared/components/*.tsx or shared/utils/*.ts'],
    ['apps/web/src/shared/utils/x.tsx', 'expected *.ts'],
    ['apps/web/src/shared/components/x.ts', 'expected *.tsx'],
    ['apps/web/src/components/academic/reason-explanation.tsx', 'components/ui/*.tsx'],
    ['apps/web/src/components/status-badge.tsx', 'components/ui/*.tsx'],
    ['apps/web/src/lib/session/cookie.ts', 'lib/*.ts only'],
    ['apps/web/src/lib/x.tsx', 'expected *.ts'],
    ['apps/api/src/modules/course-verification/verify.logic.ts', '.logic.ts'],
    ['apps/api/src/modules/foo/foo.helpers.ts', '.logic.ts'],
  ])('rejects %s', (path, expected) => {
    expect(checkStructure(path)).toContain(expected);
  });
});

describe('checkStructure keeps apps/web/src TypeScript-only', () => {
  it.each([
    'apps/web/src/app/overview/page.js',
    'apps/web/src/app/overview/page.jsx',
    'apps/web/src/features/session/actions/dev-sign-in.action.js',
    'apps/web/src/shared/utils/x.mjs',
    'apps/web/src/lib/x.cjs',
    'apps/web/src/app/route.js',
  ])('rejects %s', (path) => {
    expect(checkStructure(path)).toContain('TypeScript only under apps/web/src');
  });

  it('leaves web config files outside src alone', () => {
    const paths = ['apps/web/next.config.mjs', 'apps/web/postcss.config.cjs'];

    expect(paths.map(checkStructure)).toEqual([null, null]);
  });
});
