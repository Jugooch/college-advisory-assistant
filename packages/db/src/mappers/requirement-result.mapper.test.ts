/**
 * @file Tests for the requirement result row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { RequirementState } from '@caa/domain';

import type { RequirementResultRow } from '../tables/requirement-result.table';
import {
  groupRequirementLinks,
  NO_REQUIREMENT_LINKS,
  type RequirementResultLinks,
  toRequirementResult,
} from './requirement-result.mapper';

const ROW: RequirementResultRow = {
  id: 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  auditSnapshotId: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081',
  position: 1,
  sourceRequirementId: 'REQ-MATH',
  parentSourceRequirementId: 'REQ-CORE',
  label: 'Mathematics core',
  state: RequirementState.Incomplete,
  remainingCreditsHundredths: 300,
  remainingCourseCount: null,
  isReusable: false,
  sourceRef: 'demo-audit:REQ-MATH',
};

const LINKS: RequirementResultLinks = {
  allocatedAttemptIds: ['a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'],
  candidateCourseIds: ['3c4d5e6f-7081-4a92-8b3c-4d5e6f708192'],
};

describe('toRequirementResult', () => {
  it('keeps only the domain fields and takes the ID lists from the links', () => {
    const result = toRequirementResult(ROW, LINKS);

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

  it('gives a requirement without link rows empty lists', () => {
    const result = toRequirementResult(ROW, NO_REQUIREMENT_LINKS);

    expect(result.allocatedAttemptIds).toEqual([]);
    expect(result.candidateCourseIds).toEqual([]);
  });

  it('rejects a stored COMPLETE requirement that still needs credits', () => {
    const row = { ...ROW, state: RequirementState.Complete };

    expect(() => toRequirementResult(row, LINKS)).toThrow(ZodError);
  });

  it('rejects a stored attempt ID that is not a UUID', () => {
    const links = { ...LINKS, allocatedAttemptIds: ['SYN-ATT-0001'] };

    expect(() => toRequirementResult(ROW, links)).toThrow(ZodError);
  });
});

describe('groupRequirementLinks', () => {
  it('groups the rows by requirement and keeps the order they arrive in', () => {
    const grouped = groupRequirementLinks(
      [
        { requirementResultId: 'req-a', courseAttemptId: 'attempt-2' },
        { requirementResultId: 'req-b', courseAttemptId: 'attempt-9' },
        { requirementResultId: 'req-a', courseAttemptId: 'attempt-1' },
      ],
      [{ requirementResultId: 'req-c', courseId: 'course-1' }],
    );

    expect(Object.fromEntries(grouped)).toEqual({
      'req-a': { allocatedAttemptIds: ['attempt-2', 'attempt-1'], candidateCourseIds: [] },
      'req-b': { allocatedAttemptIds: ['attempt-9'], candidateCourseIds: [] },
      'req-c': { allocatedAttemptIds: [], candidateCourseIds: ['course-1'] },
    });
  });

  it('returns no entries when the audit has no link rows', () => {
    expect(groupRequirementLinks([], []).size).toBe(0);
  });
});
