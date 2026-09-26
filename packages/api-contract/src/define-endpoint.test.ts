/**
 * @file Type-level tests for endpoint path params.
 */
import { describe, expectTypeOf, it } from 'vitest';

import type { PathParamName } from './define-endpoint';

describe('PathParamName', () => {
  it('is never for a path without params', () => {
    expectTypeOf<PathParamName<'/v1/health'>>().toEqualTypeOf<never>();
  });

  it('extracts a trailing param', () => {
    expectTypeOf<PathParamName<'/v1/students/:studentId'>>().toEqualTypeOf<'studentId'>();
  });

  it('extracts params in the middle and at the end', () => {
    expectTypeOf<PathParamName<'/v1/plans/:planId/sections/:sectionId'>>().toEqualTypeOf<
      'planId' | 'sectionId'
    >();
  });
});
