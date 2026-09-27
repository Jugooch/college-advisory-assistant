/**
 * @file Tests for the synthetic requirement result builder.
 */
import { describe, expect, it } from 'vitest';

import { RequirementResultSchema, RequirementState } from '@caa/domain';

import { buildRequirementResult } from './requirement-result.builder';

describe('buildRequirementResult', () => {
  it('defaults to an incomplete top-level math requirement with one course remaining', () => {
    expect(buildRequirementResult()).toEqual({
      sourceRequirementId: 'REQ-001',
      parentSourceRequirementId: null,
      label: 'Mathematics core',
      state: 'INCOMPLETE',
      allocatedAttemptIds: [],
      remainingCreditsHundredths: 300,
      remainingCourseCount: 1,
      candidateCourseIds: ['50000000-0000-4000-8000-000000000102'],
      isReusable: false,
      sourceRef: 'demo-audit/REQ-001',
    });
  });

  it('returns deep-equal requirements for the same arguments', () => {
    expect(buildRequirementResult({}, 2)).toEqual(buildRequirementResult({}, 2));
  });

  it('derives the requirement ID and source reference from the seed', () => {
    const result = buildRequirementResult({}, 12);

    expect(result.sourceRequirementId).toBe('REQ-012');
    expect(result.sourceRef).toBe('demo-audit/REQ-012');
  });

  it('applies overrides', () => {
    const result = buildRequirementResult({
      parentSourceRequirementId: 'REQ-000',
      state: RequirementState.Complete,
      remainingCreditsHundredths: 0,
      remainingCourseCount: 0,
      allocatedAttemptIds: ['60000000-0000-4000-8000-000000000001'],
      isReusable: true,
    });

    expect(result.parentSourceRequirementId).toBe('REQ-000');
    expect(result.state).toBe('COMPLETE');
    expect(result.allocatedAttemptIds).toEqual(['60000000-0000-4000-8000-000000000001']);
    expect(result.isReusable).toBe(true);
  });

  it('returns a requirement that passes the domain schema', () => {
    expect(RequirementResultSchema.safeParse(buildRequirementResult()).success).toBe(true);
  });

  it('rejects a COMPLETE requirement that still has credits remaining', () => {
    expect(() => buildRequirementResult({ state: RequirementState.Complete })).toThrow();
  });
});
