/**
 * @file Tests for the file placement rules, focused on test file suffixes.
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
});
