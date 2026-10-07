/**
 * @file Tests that course display entries state the catalog code and credit rule exactly, only
 * for named catalog courses, once each.
 * @requirement FR-10
 * @requirement NFR-02
 */
import { describe, expect, it } from 'vitest';

import { type Course, CreditRuleKind } from '@caa/domain';
import { buildCourse } from '@caa/test-kit';

import { selectCourseDisplays } from './course-display.logic';

const fixed = buildCourse(
  { label: 'DEMO-MATH 101', title: 'Demo Calculus I', creditsHundredths: 300 },
  1,
);
const variable = buildCourse(
  {
    label: 'DEMO-IND 390',
    creditsHundredths: null,
    minCreditsHundredths: 100,
    maxCreditsHundredths: 300,
  },
  2,
);
const unnamed = buildCourse({ label: 'DEMO-ENGL 101' }, 3);
const catalog = [fixed, variable, unnamed];

describe('selectCourseDisplays', () => {
  it('states a fixed and a variable credit rule from the catalog, and null for an unstated title', () => {
    expect(selectCourseDisplays([fixed.id, variable.id], catalog)).toEqual([
      {
        courseId: fixed.id,
        code: 'DEMO-MATH 101',
        title: 'Demo Calculus I',
        credits: { kind: CreditRuleKind.Fixed, creditsHundredths: 300 },
      },
      {
        courseId: variable.id,
        code: 'DEMO-IND 390',
        title: null,
        credits: {
          kind: CreditRuleKind.Variable,
          minCreditsHundredths: 100,
          maxCreditsHundredths: 300,
        },
      },
    ]);
  });

  it('lists each named course once, in first-named order, and no unnamed course', () => {
    const displays = selectCourseDisplays([variable.id, fixed.id, variable.id], catalog);

    expect(displays.map((display) => display.courseId)).toEqual([variable.id, fixed.id]);
  });

  it('gives no entry to a course outside the catalog', () => {
    const outside = buildCourse({}, 9);

    expect(selectCourseDisplays([outside.id, fixed.id], catalog)).toHaveLength(1);
  });

  it('gives no entry, never an invented range, to a variable course missing a bound', () => {
    const broken: Course = { ...variable, maxCreditsHundredths: null };

    expect(selectCourseDisplays([broken.id], [broken])).toEqual([]);
  });

  it('returns nothing when no course is named', () => {
    expect(selectCourseDisplays([], catalog)).toEqual([]);
  });
});
