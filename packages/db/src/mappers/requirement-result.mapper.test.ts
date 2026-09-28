/**
 * @file Tests for the requirement result row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { RequirementState } from '@caa/domain';

import type { RequirementResultRow } from '../tables/requirement-result.table';
import { toRequirementResult } from './requirement-result.mapper';

const ROW: RequirementResultRow = {
  id: 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  auditSnapshotId: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081',
  position: 1,
  sourceRequirementId: 'REQ-MATH',
  parentSourceRequirementId: 'REQ-CORE',
  label: 'Mathematics core',
  state: RequirementState.Incomplete,
  allocatedAttemptIds: ['a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'],
  remainingCreditsHundredths: 300,
  remainingCourseCount: null,
  candidateCourseIds: ['3c4d5e6f-7081-4a92-8b3c-4d5e6f708192'],
  isReusable: false,
  sourceRef: 'demo-audit:REQ-MATH',
};

describe('toRequirementResult', () => {
  it('keeps only the domain fields', () => {
    const result = toRequirementResult(ROW);

    expect(result).toEqual({
      sourceRequirementId: 'REQ-MATH',
      parentSourceRequirementId: 'REQ-CORE',
      label: 'Mathematics core',
      state: 'INCOMPLETE',
      allocatedAttemptIds: ['a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'],
      remainingCreditsHundredths: 300,
      remainingCourseCount: null,
      candidateCourseIds: ['3c4d5e6f-7081-4a92-8b3c-4d5e6f708192'],
      isReusable: false,
      sourceRef: 'demo-audit:REQ-MATH',
    });
  });

  it('rejects a stored COMPLETE requirement that still needs credits', () => {
    const row = { ...ROW, state: RequirementState.Complete };

    expect(() => toRequirementResult(row)).toThrow(ZodError);
  });

  it('rejects a stored attempt ID that is not a UUID', () => {
    expect(() => toRequirementResult({ ...ROW, allocatedAttemptIds: ['SYN-ATT-0001'] })).toThrow(
      ZodError,
    );
  });
});
