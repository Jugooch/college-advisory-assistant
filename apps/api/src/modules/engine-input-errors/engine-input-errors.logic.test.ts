/**
 * @file Tests that each engine input error is classified by who caused it: the request, stored
 * data, or an internal defect.
 * @requirement FR-09
 * @requirement NFR-04
 */
import { describe, expect, it } from 'vitest';

import {
  AuditRecordInputError,
  CandidateSetInputError,
  PrerequisiteInputMismatchError,
  ScheduleInputError,
} from '@caa/engine';

import { classifyEngineInputError } from './engine-input-errors.logic';

describe('classifyEngineInputError', () => {
  it.each([
    ['duplicateCourse', 'REQUEST'],
    ['equivalentCourses', 'REQUEST'],
    ['selectedCredits', 'REQUEST'],
    ['courseCredits', 'STORED_DATA'],
    ['bounds', 'STORED_DATA'],
    ['totalCredits', 'STORED_DATA'],
  ] as const)('classifies the candidate set issue %s as %s', (issue, cause) => {
    expect(classifyEngineInputError(new CandidateSetInputError(issue))).toEqual({
      cause,
      reason: `CandidateSetInputError:${issue}`,
    });
  });

  it.each([
    ['courseInTwoRequests', 'REQUEST'],
    ['creditRange', 'REQUEST'],
    ['linkCycle', 'STORED_DATA'],
    ['courseMissing', 'STORED_DATA'],
    ['creditInclusionUnknown', 'STORED_DATA'],
    ['tenantMismatch', 'INTERNAL'],
    ['sameSection', 'INTERNAL'],
    ['workCap', 'INTERNAL'],
    ['requests', 'INTERNAL'],
  ] as const)('classifies the schedule input issue %s as %s', (issue, cause) => {
    expect(classifyEngineInputError(new ScheduleInputError(issue))).toEqual({
      cause,
      reason: `ScheduleInputError:${issue}`,
    });
  });

  it.each([
    'audit.studentRecordEffectiveAt',
    'studentSnapshot.sourceEffectiveAt',
    'maxSkewMs',
  ] as const)('classifies an audit record input error on %s as stored data', (field) => {
    expect(classifyEngineInputError(new AuditRecordInputError(field))).toEqual({
      cause: 'STORED_DATA',
      reason: 'AuditRecordInputError',
    });
  });

  it.each(['tenantId', 'rulesetVersion'] as const)(
    'classifies a rule and policy %s mismatch as internal',
    (field) => {
      expect(classifyEngineInputError(new PrerequisiteInputMismatchError(field))).toEqual({
        cause: 'INTERNAL',
        reason: 'PrerequisiteInputMismatchError',
      });
    },
  );

  it.each([
    ['a plain error', new Error('boom')],
    ['a non-error value', 'boom'],
  ])('returns null for %s', (_case, error) => {
    expect(classifyEngineInputError(error)).toBeNull();
  });
});
