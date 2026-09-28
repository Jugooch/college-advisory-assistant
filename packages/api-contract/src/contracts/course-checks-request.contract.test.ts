/**
 * @file Tests for the course-checks request body.
 */
import { describe, expect, it } from 'vitest';

import { CourseChecksRequestSchema } from './course-checks-request.contract';

const CALC = '00000000-0000-4000-8000-000000000101';
const PHYSICS = '00000000-0000-4000-8000-000000000102';
const RESEARCH = '00000000-0000-4000-8000-000000000103';

/**
 * Builds a distinct synthetic course ID.
 *
 * @param seed - Number that makes the ID unique.
 * @returns A UUID string.
 */
const courseId = (seed: number): string =>
  `00000000-0000-4000-8000-${String(seed).padStart(12, '0')}`;

describe('CourseChecksRequestSchema', () => {
  const accepts = (body: unknown): boolean => CourseChecksRequestSchema.safeParse(body).success;

  it('accepts one course with no credit selections', () => {
    expect(CourseChecksRequestSchema.parse({ courseIds: [CALC] })).toEqual({ courseIds: [CALC] });
  });

  it('accepts a credit selection for a listed course', () => {
    const body = {
      courseIds: [CALC, RESEARCH],
      creditSelections: [{ courseId: RESEARCH, selectedCreditsHundredths: 200 }],
    };

    expect(CourseChecksRequestSchema.parse(body)).toEqual(body);
  });

  it('accepts 1 to 12 courses and rejects 0 or 13', () => {
    const ids = Array.from({ length: 13 }, (_, index) => courseId(index + 1));

    expect(accepts({ courseIds: ids.slice(0, 12) })).toBe(true);
    expect(accepts({ courseIds: [] })).toBe(false);
    expect(accepts({ courseIds: ids })).toBe(false);
  });

  it('rejects a repeated course', () => {
    expect(accepts({ courseIds: [CALC, PHYSICS, CALC] })).toBe(false);
  });

  it('rejects a course ID that is not a UUID', () => {
    expect(accepts({ courseIds: ['MATH-101'] })).toBe(false);
  });

  it('rejects two credit selections for one course', () => {
    const selection = { courseId: RESEARCH, selectedCreditsHundredths: 200 };

    expect(accepts({ courseIds: [RESEARCH], creditSelections: [selection, selection] })).toBe(
      false,
    );
  });

  it('rejects a credit selection for a course not in courseIds', () => {
    const creditSelections = [{ courseId: RESEARCH, selectedCreditsHundredths: 200 }];

    expect(accepts({ courseIds: [CALC], creditSelections })).toBe(false);
  });

  it('rejects fractional or negative credit values', () => {
    const withCredits = (selectedCreditsHundredths: number): unknown => ({
      courseIds: [RESEARCH],
      creditSelections: [{ courseId: RESEARCH, selectedCreditsHundredths }],
    });

    expect(accepts(withCredits(2.5))).toBe(false);
    expect(accepts(withCredits(-100))).toBe(false);
  });

  it.each([
    ['tenantId', '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f'],
    ['userId', '1a2b3c4d-0000-4000-8000-000000000001'],
    ['role', 'ADVISOR'],
    ['roles', ['ADVISOR']],
  ])('rejects a body that carries %s', (field, value) => {
    expect(accepts({ courseIds: [CALC], [field]: value })).toBe(false);
  });

  it('rejects an unknown field inside a credit selection', () => {
    const creditSelections = [
      { courseId: RESEARCH, selectedCreditsHundredths: 200, tenantId: CALC },
    ];

    expect(accepts({ courseIds: [RESEARCH], creditSelections })).toBe(false);
  });
});
