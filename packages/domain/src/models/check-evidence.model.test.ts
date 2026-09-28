/**
 * @file Tests for the check evidence data object.
 */
import { describe, expect, it } from 'vitest';

import { ReasonCode } from '../enums/reason-code.enum';
import { CheckEvidenceSchema, createCheckEvidence } from './check-evidence.model';

const COURSE_ID = '00000000-0000-4000-8000-000000000101';
const ATTEMPT_ID = '00000000-0000-4000-8000-000000000201';

const COURSE_LEAF = {
  type: 'COURSE',
  path: [1],
  courseId: COURSE_ID,
  requiredGrade: { scheme: 'LETTER', value: 'C' },
  attemptIds: [ATTEMPT_ID],
  reasonCode: ReasonCode.InProgressMinGrade,
} as const;

describe('createCheckEvidence', () => {
  it('accepts the ruleset version and a course leaf with its grade and attempts', () => {
    const evidence = createCheckEvidence({
      rulesetVersion: 'demo-2026.1',
      decisiveLeaves: [COURSE_LEAF],
    });

    expect(evidence).toEqual({ rulesetVersion: 'demo-2026.1', decisiveLeaves: [COURSE_LEAF] });
  });

  it('accepts a null ruleset version and no leaves for a check without a rule expression', () => {
    const evidence = createCheckEvidence({ rulesetVersion: null, decisiveLeaves: [] });

    expect(evidence.rulesetVersion).toBeNull();
    expect(evidence.decisiveLeaves).toEqual([]);
  });

  it('accepts a root leaf with an empty path, no attempts, and no minimum grade', () => {
    const [leaf] = createCheckEvidence({
      rulesetVersion: 'demo-2026.1',
      decisiveLeaves: [
        { ...COURSE_LEAF, path: [], attemptIds: [], requiredGrade: null, reasonCode: null },
      ],
    }).decisiveLeaves;

    expect(leaf).toMatchObject({ path: [], attemptIds: [], requiredGrade: null });
  });

  it('accepts an unsupported leaf with its source text', () => {
    const [leaf] = createCheckEvidence({
      rulesetVersion: 'demo-2026.1',
      decisiveLeaves: [
        {
          type: 'UNSUPPORTED',
          path: [0, 2],
          sourceText: 'Consent of the demo department',
          reasonCode: ReasonCode.UnsupportedRule,
        },
      ],
    }).decisiveLeaves;

    expect(leaf?.type).toBe('UNSUPPORTED');
  });
});

describe('CheckEvidenceSchema', () => {
  const parseLeaf = (leaf: Record<string, unknown>): boolean =>
    CheckEvidenceSchema.safeParse({ rulesetVersion: 'demo-2026.1', decisiveLeaves: [leaf] })
      .success;

  it('rejects an empty ruleset version, because unknown is null', () => {
    expect(CheckEvidenceSchema.safeParse({ rulesetVersion: '', decisiveLeaves: [] }).success).toBe(
      false,
    );
  });

  it('rejects an omitted ruleset version', () => {
    expect(CheckEvidenceSchema.safeParse({ decisiveLeaves: [] }).success).toBe(false);
  });

  it('rejects a negative or fractional path index', () => {
    expect(parseLeaf({ ...COURSE_LEAF, path: [-1] })).toBe(false);
    expect(parseLeaf({ ...COURSE_LEAF, path: [0.5] })).toBe(false);
  });

  it('rejects an omitted required grade, because no minimum is an explicit null', () => {
    const { requiredGrade: omitted, ...withoutGrade } = COURSE_LEAF;

    expect(omitted).toBeDefined();
    expect(parseLeaf(withoutGrade)).toBe(false);
  });

  it('rejects a required grade that is invalid for its scheme', () => {
    expect(parseLeaf({ ...COURSE_LEAF, requiredGrade: { scheme: 'LETTER', value: 'P' } })).toBe(
      false,
    );
  });

  it('rejects an attempt ID that is not a UUID', () => {
    expect(parseLeaf({ ...COURSE_LEAF, attemptIds: ['attempt-1'] })).toBe(false);
  });

  it('rejects a free-text reason code on a leaf', () => {
    expect(parseLeaf({ ...COURSE_LEAF, reasonCode: 'SOMETHING_WENT_WRONG' })).toBe(false);
  });

  it('rejects an unknown leaf type', () => {
    expect(parseLeaf({ ...COURSE_LEAF, type: 'PLACEMENT' })).toBe(false);
  });

  it('rejects an unsupported leaf without source text', () => {
    expect(
      parseLeaf({ type: 'UNSUPPORTED', path: [], sourceText: '', reasonCode: 'UNSUPPORTED_RULE' }),
    ).toBe(false);
  });

  it('rejects decisive leaves given as a map instead of a list', () => {
    expect(
      CheckEvidenceSchema.safeParse({ rulesetVersion: null, decisiveLeaves: {} }).success,
    ).toBe(false);
  });
});

describe('CheckEvidenceSchema courses and credit load', () => {
  const OTHER_COURSE_ID = '00000000-0000-4000-8000-000000000102';
  const LOAD = {
    totalCreditsHundredths: 1350,
    minCreditsHundredths: 1200,
    maxCreditsHundredths: 1800,
  } as const;
  const base = { rulesetVersion: 'demo-2026.1', decisiveLeaves: [] } as const;
  const parses = (extra: Record<string, unknown>): boolean =>
    CheckEvidenceSchema.safeParse({ ...base, ...extra }).success;

  it('parses evidence without the new fields unchanged, so existing producers keep working', () => {
    expect(createCheckEvidence(base)).toEqual({
      rulesetVersion: 'demo-2026.1',
      decisiveLeaves: [],
    });
    expect(createCheckEvidence(base)).not.toHaveProperty('courseIds');
    expect(createCheckEvidence(base)).not.toHaveProperty('creditLoad');
  });

  it('keeps course IDs in input order', () => {
    const evidence = createCheckEvidence({ ...base, courseIds: [OTHER_COURSE_ID, COURSE_ID] });

    expect(evidence.courseIds).toEqual([OTHER_COURSE_ID, COURSE_ID]);
  });

  it('accepts an empty course list', () => {
    expect(createCheckEvidence({ ...base, courseIds: [] }).courseIds).toEqual([]);
  });

  it('rejects a course ID that is not a UUID', () => {
    expect(parses({ courseIds: ['MATH 101'] })).toBe(false);
  });

  it('keeps the credit arithmetic in hundredths', () => {
    expect(createCheckEvidence({ ...base, creditLoad: LOAD }).creditLoad).toEqual(LOAD);
  });

  it('accepts a null credit load for an unknown total or bound', () => {
    expect(createCheckEvidence({ ...base, creditLoad: null }).creditLoad).toBeNull();
  });

  it('accepts a total outside the bounds, because that is what a failing check reports', () => {
    expect(parses({ creditLoad: { ...LOAD, totalCreditsHundredths: 2100 } })).toBe(true);
    expect(parses({ creditLoad: { ...LOAD, totalCreditsHundredths: 0 } })).toBe(true);
  });

  it('accepts equal minimum and maximum bounds', () => {
    expect(parses({ creditLoad: { ...LOAD, minCreditsHundredths: 1800 } })).toBe(true);
  });

  it('rejects a minimum above the maximum', () => {
    expect(parses({ creditLoad: { ...LOAD, minCreditsHundredths: 1900 } })).toBe(false);
  });

  it('rejects negative or fractional credit amounts', () => {
    expect(parses({ creditLoad: { ...LOAD, totalCreditsHundredths: -100 } })).toBe(false);
    expect(parses({ creditLoad: { ...LOAD, minCreditsHundredths: 12.5 } })).toBe(false);
    expect(parses({ creditLoad: { ...LOAD, maxCreditsHundredths: 18.25 } })).toBe(false);
  });

  it('rejects a credit load with a missing field', () => {
    const { maxCreditsHundredths: omitted, ...withoutMax } = LOAD;

    expect(omitted).toBe(1800);
    expect(parses({ creditLoad: withoutMax })).toBe(false);
  });
});
