/**
 * @file Tests for path-param substitution.
 */
import { describe, expect, it } from 'vitest';

import { buildPath, MissingPathParamError } from './build-path';

describe('buildPath', () => {
  it('returns a path without params unchanged', () => {
    expect(buildPath('/v1/health', {})).toBe('/v1/health');
  });

  it('substitutes every param in the path', () => {
    const path = buildPath('/v1/plans/:planId/sections/:sectionId', {
      planId: 'plan-1',
      sectionId: 'section-2',
    });

    expect(path).toBe('/v1/plans/plan-1/sections/section-2');
  });

  it('URL-encodes slashes and spaces so a value stays in one segment', () => {
    expect(buildPath('/v1/students/:studentId', { studentId: 'DEMO/S 01' })).toBe(
      '/v1/students/DEMO%2FS%2001',
    );
  });

  it('throws MissingPathParamError naming the param when a value is absent', () => {
    const build = (): string => buildPath('/v1/students/:studentId', {});

    expect(build).toThrow(MissingPathParamError);
    expect(build).toThrow(expect.objectContaining({ paramName: 'studentId' }));
  });

  it('treats an empty value as missing', () => {
    expect(() => buildPath('/v1/students/:studentId', { studentId: '' })).toThrow(
      MissingPathParamError,
    );
  });
});
