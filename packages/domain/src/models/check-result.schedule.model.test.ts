/**
 * @file Tests that schedule issues agree with the SCHEDULE_FEASIBILITY check they explain.
 */
import { describe, expect, it } from 'vitest';

import { CheckResultSchema } from './check-result.model';

const PHYS_301L = 'c0a5e000-0000-4000-8000-000000003010';
const MISSING = { reasonCode: 'SECTION_DATA_MISSING', courseId: PHYS_301L };
const MODALITY = {
  reasonCode: 'MODALITY_NOT_ALLOWED',
  sectionId: '5ec71010-0000-4000-8000-000000000011',
  modality: 'IN_PERSON',
  constraintIndex: 0,
};

const schedule = (state: string, reasonCode: string | null, issues: readonly object[] | null) => ({
  kind: 'SCHEDULE_FEASIBILITY',
  state,
  ...(reasonCode === null ? {} : { reasonCode }),
  ...(issues === null
    ? {}
    : { evidence: { rulesetVersion: null, decisiveLeaves: [], scheduleIssues: issues } }),
});

const messages = (payload: unknown): readonly string[] =>
  CheckResultSchema.safeParse(payload).error?.issues.map((issue) => issue.message) ?? [];

const EXPLAIN =
  'A non-passing SCHEDULE_FEASIBILITY check needs scheduleIssues that agree with its state and reasonCode (an undecided credit load excepted), and a PASS has none';

describe('CheckResultSchema schedule issues', () => {
  it('accepts a PASS schedule with no issues', () => {
    expect(messages(schedule('PASS', null, null))).toEqual([]);
  });

  it('accepts an UNKNOWN schedule explained by UNKNOWN issues', () => {
    expect(messages(schedule('UNKNOWN', 'SECTION_DATA_MISSING', [MISSING]))).toEqual([]);
  });

  it('accepts a FAIL schedule explained by FAIL issues', () => {
    expect(messages(schedule('FAIL', 'MODALITY_NOT_ALLOWED', [MODALITY]))).toEqual([]);
  });

  it('rejects a non-passing schedule with no issues', () => {
    expect(messages(schedule('FAIL', 'MODALITY_NOT_ALLOWED', null))).toEqual([EXPLAIN]);
  });

  it('rejects a PASS schedule shown beside an issue', () => {
    expect(messages(schedule('PASS', null, [MODALITY]))).toEqual([EXPLAIN]);
  });

  it('rejects an UNKNOWN issue explaining a FAIL, and a FAIL issue under an UNKNOWN', () => {
    expect(messages(schedule('FAIL', 'SECTION_DATA_MISSING', [MISSING]))).toEqual([EXPLAIN]);
    expect(messages(schedule('UNKNOWN', 'MODALITY_NOT_ALLOWED', [MODALITY]))).toEqual([EXPLAIN]);
  });

  it.each(['VARIABLE_CREDIT_UNSELECTED', 'CREDIT_BOUNDS_UNDEFINED'])(
    'accepts an UNKNOWN schedule left undecided by the credit load (%s) with no issue',
    (reasonCode) => {
      expect(messages(schedule('UNKNOWN', reasonCode, null))).toEqual([]);
    },
  );

  it('rejects a credit-load reason on a FAIL schedule, or beside a FAIL issue', () => {
    expect(messages(schedule('FAIL', 'CREDIT_LIMIT_EXCEEDED', null))).toEqual([EXPLAIN]);
    expect(messages(schedule('UNKNOWN', 'VARIABLE_CREDIT_UNSELECTED', [MODALITY]))).toEqual([
      EXPLAIN,
    ]);
  });

  it('rejects a reason code that none of the issues has', () => {
    expect(messages(schedule('UNKNOWN', 'TRANSITION_TIME_UNDEFINED', [MISSING]))).toEqual([
      EXPLAIN,
    ]);
  });

  it('rejects an empty issue list, because none is written by omitting the field', () => {
    expect(CheckResultSchema.safeParse(schedule('PASS', null, [])).success).toBe(false);
  });

  it('rejects schedule issues on another kind of check', () => {
    const load = {
      kind: 'CREDIT_LOAD',
      state: 'UNKNOWN',
      reasonCode: 'CREDIT_BOUNDS_UNDEFINED',
      evidence: { rulesetVersion: null, decisiveLeaves: [], scheduleIssues: [MISSING] },
    };

    expect(messages(load)).toEqual(['Only SCHEDULE_FEASIBILITY checks may have scheduleIssues']);
  });
});
