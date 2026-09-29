/**
 * @file Tests for the schedule-options request body.
 */
import { describe, expect, it } from 'vitest';

import { TERM_ID } from '../testing/schedule-option-fixtures';
import { ScheduleOptionsRequestSchema } from './schedule-options-request.contract';

const courseId = (seed: number): string =>
  `c0a5e000-0000-4000-8000-${String(seed).padStart(12, '0')}`;

const VALID = {
  termId: TERM_ID,
  courseIds: [courseId(301), courseId(390)],
  creditSelections: [{ courseId: courseId(390), selectedCreditsHundredths: 200 }],
  constraints: [
    {
      kind: 'UNAVAILABLE_TIME',
      strength: 'HARD',
      priorityRank: null,
      weekdays: ['FRIDAY'],
      startTime: '00:00',
      endTime: '24:00',
    },
    {
      kind: 'CREDIT_RANGE',
      strength: 'PREFERRED',
      priorityRank: 1,
      minCreditsHundredths: 1200,
      maxCreditsHundredths: null,
    },
  ],
};

const accepts = (payload: unknown): boolean =>
  ScheduleOptionsRequestSchema.safeParse(payload).success;

describe('ScheduleOptionsRequestSchema', () => {
  it('accepts a term, courses, a credit selection, and constraints', () => {
    expect(ScheduleOptionsRequestSchema.parse(VALID)).toEqual(VALID);
  });

  it('accepts one course with no credit selections and no constraints', () => {
    expect(
      accepts({ ...VALID, courseIds: [courseId(301)], creditSelections: [], constraints: [] }),
    ).toBe(true);
  });

  it('accepts eight courses and rejects nine', () => {
    const eight = Array.from({ length: 8 }, (_, index) => courseId(index + 1));

    expect(accepts({ ...VALID, courseIds: eight, creditSelections: [] })).toBe(true);
    expect(accepts({ ...VALID, courseIds: [...eight, courseId(9)], creditSelections: [] })).toBe(
      false,
    );
  });

  it('rejects no courses', () => {
    expect(accepts({ ...VALID, courseIds: [], creditSelections: [] })).toBe(false);
  });

  it('rejects a duplicate course', () => {
    const result = ScheduleOptionsRequestSchema.safeParse({
      ...VALID,
      courseIds: [courseId(301), courseId(301)],
      creditSelections: [],
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'courseIds must not repeat a course',
    ]);
  });

  it.each(['tenantId', 'userId', 'role'])('rejects a body that names %s', (field) => {
    expect(accepts({ ...VALID, [field]: 'x' })).toBe(false);
  });

  it('rejects two credit selections for one course, or one for an unrequested course', () => {
    const selection = { courseId: courseId(390), selectedCreditsHundredths: 100 };

    expect(accepts({ ...VALID, creditSelections: [selection, selection] })).toBe(false);
    expect(
      accepts({
        ...VALID,
        creditSelections: [{ courseId: courseId(999), selectedCreditsHundredths: 100 }],
      }),
    ).toBe(false);
  });

  it('rejects an omitted creditSelections or constraints field', () => {
    const { termId, courseIds, creditSelections, constraints } = VALID;

    expect(accepts({ termId, courseIds, constraints })).toBe(false);
    expect(accepts({ termId, courseIds, creditSelections })).toBe(false);
  });

  it('rejects a self-contradictory constraint set', () => {
    const contradictory = {
      kind: 'CREDIT_RANGE',
      strength: 'HARD',
      priorityRank: null,
      minCreditsHundredths: 1800,
      maxCreditsHundredths: 1200,
    };

    expect(accepts({ ...VALID, constraints: [contradictory] })).toBe(false);
  });

  it('rejects a term ID that is not a UUID', () => {
    expect(accepts({ ...VALID, termId: '2026FA' })).toBe(false);
  });
});
