/**
 * @file Tests for the advisor case enums.
 */
import { describe, expect, it } from 'vitest';

import { CaseActionSchema } from './case-action.enum';
import { CaseReasonSchema } from './case-reason.enum';
import { CaseResolutionSchema } from './case-resolution.enum';
import { CaseStatusSchema } from './case-status.enum';
import { DiscrepancySubjectSchema } from './discrepancy-subject.enum';

describe('advisor case enums', () => {
  it.each([
    [CaseStatusSchema, ['OPEN', 'IN_REVIEW', 'RESOLVED', 'WITHDRAWN']],
    [CaseReasonSchema, ['PLAN_REVIEW', 'NEEDS_VERIFICATION', 'SOURCE_DISCREPANCY']],
    [CaseActionSchema, ['CREATE', 'CLAIM', 'RELEASE', 'RESOLVE', 'WITHDRAW']],
    [CaseResolutionSchema, ['PLAN_REVIEWED', 'STUDENT_ACTION_NEEDED', 'REFERRED_OUTSIDE_APP']],
    [
      DiscrepancySubjectSchema,
      ['PROGRAM_OR_CATALOG', 'COURSE_ATTEMPT', 'AUDIT_REQUIREMENT', 'SECTION'],
    ],
  ])('has exactly the registered values', (schema, values) => {
    expect(schema.options).toEqual(values);
    expect(schema.safeParse('MAYBE').success).toBe(false);
  });
});
