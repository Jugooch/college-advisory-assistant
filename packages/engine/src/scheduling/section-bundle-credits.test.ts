/**
 * @file Tests for counting included credits once across a plan, and unknown inclusion as UNKNOWN.
 */
import { describe, expect, it } from 'vitest';

import type { Course, CourseId } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildCourse,
  buildSection,
  buildVariableCreditCourse,
} from '@caa/test-kit';

import { checkCreditLoad } from '../verification/check-credit-load';
import { ScheduleInputError } from './schedule-input-error';
import {
  countsCreditsInPlan,
  coursesOfBundle,
  toBundleCourseSelections,
} from './section-bundle-credits';

const LECTURE_COURSE = buildCourse({}, 1);
const POLICY = buildAcademicPolicy({
  termCreditBounds: { minCreditsHundredths: 0, maxCreditsHundredths: 1800 },
});

/**
 * Builds a 1-credit lab course with the given inclusion.
 *
 * @param creditsIncludedInCourseId - The including course, or `null`.
 * @returns The lab course.
 */
function labCourse(creditsIncludedInCourseId: string | null): Course {
  return buildCourse({ creditsHundredths: 100, creditsIncludedInCourseId }, 2);
}

/**
 * Removes a course's credit inclusion key, as a producer that hasn't set it would.
 *
 * NOTE: covers the omitted-value branch `countsCreditsInPlan` keeps for the API's course checks.
 * TODO(#229): remove with that branch once the API no longer relies on it.
 *
 * @param course - A valid course.
 * @returns The course without `creditsIncludedInCourseId`.
 */
function withoutInclusion(course: Course): Course {
  const omitted: Record<string, unknown> = { ...course };
  delete omitted.creditsIncludedInCourseId;
  return omitted as Course;
}

/**
 * Totals a plan's credit load through `checkCreditLoad`.
 *
 * @param bundles - The plan's bundles, as course lists.
 * @returns The counted total in hundredths.
 */
function totalOf(bundles: readonly (readonly Course[])[]): number | undefined {
  const selections = toBundleCourseSelections(
    bundles.map((courses) => ({ courses })),
    new Map(),
  );
  return checkCreditLoad(selections, POLICY).evidence?.creditLoad?.totalCreditsHundredths;
}

describe('coursesOfBundle', () => {
  it('lists each course once, in the order its first section appears', () => {
    const lab = labCourse(null);
    const sections = [
      buildSection({}, 1),
      buildSection({ courseId: lab.id }, 2),
      buildSection({ courseId: lab.id }, 3),
    ];
    const courseById = new Map<CourseId, Course>([
      [lab.id, lab],
      [LECTURE_COURSE.id, LECTURE_COURSE],
    ]);

    expect(coursesOfBundle(sections, courseById)).toEqual([LECTURE_COURSE, lab]);
  });

  it("throws courseMissing when a section's course isn't supplied", () => {
    expect(() => coursesOfBundle([buildSection({}, 1)], new Map())).toThrow(
      new ScheduleInputError('courseMissing'),
    );
  });
});

describe('countsCreditsInPlan', () => {
  const plan = new Set([LECTURE_COURSE.id, labCourse(null).id]);

  it('is false for a lab whose including course is in the plan', () => {
    expect(countsCreditsInPlan(labCourse(LECTURE_COURSE.id), plan)).toBe(false);
  });

  it('is true for a lab whose credits are included nowhere', () => {
    expect(countsCreditsInPlan(labCourse(null), plan)).toBe(true);
  });

  it('is unknown for an omitted inclusion when another course of the plan could include it', () => {
    expect(countsCreditsInPlan(withoutInclusion(labCourse(null)), plan)).toBeNull();
  });

  it('is true for a lone course with an omitted inclusion, since nothing in the plan includes it', () => {
    const lone = withoutInclusion(LECTURE_COURSE);

    expect(countsCreditsInPlan(lone, new Set([lone.id]))).toBe(true);
  });
});

describe('toBundleCourseSelections', () => {
  it('counts a 3-credit lecture with an included 1-credit lab in its bundle as 3 credits', () => {
    expect(totalOf([[LECTURE_COURSE, labCourse(LECTURE_COURSE.id)]])).toBe(300);
  });

  it('counts an included lab once when its lecture is in another bundle of the plan', () => {
    expect(totalOf([[LECTURE_COURSE], [labCourse(LECTURE_COURSE.id)]])).toBe(300);
  });

  it('counts its own credits for a lab whose including course is not in the plan', () => {
    expect(totalOf([[buildCourse({}, 3)], [labCourse(LECTURE_COURSE.id)]])).toBe(400);
  });

  it('counts its own credits for a lab whose credits are included nowhere', () => {
    expect(totalOf([[LECTURE_COURSE, labCourse(null)]])).toBe(400);
  });

  it('passes the chosen value of a variable-credit course', () => {
    const variable = buildVariableCreditCourse({}, 3);

    expect(
      toBundleCourseSelections([{ courses: [variable] }], new Map([[variable.id, 200]])),
    ).toEqual([{ course: variable, selectedCreditsHundredths: 200, countsCredits: true }]);
  });
});
