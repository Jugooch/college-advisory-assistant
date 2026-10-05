/**
 * @file Tests for counting a bundle's included credits once, and unknown inclusion as UNKNOWN.
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
import { creditsOfBundle, toBundleCourseSelections } from './section-bundle-credits';

const LECTURE_COURSE = buildCourse({}, 1);
const LECTURE = buildSection({}, 1);

/**
 * Builds a 1-credit lab course with the given inclusion.
 *
 * @param creditsIncludedInCourseId - The including course, `null`, or `undefined` (omitted).
 * @returns The lab course.
 */
function labCourse(creditsIncludedInCourseId: string | null | undefined): Course {
  return buildCourse({ creditsHundredths: 100, creditsIncludedInCourseId }, 2);
}

/**
 * Works out the credits of the lecture with one lab of the given course.
 *
 * @param lab - The lab course.
 * @returns Each course of the bundle and whether it counts.
 */
function creditsWithLab(lab: Course): ReturnType<typeof creditsOfBundle> {
  const labSection = buildSection({ courseId: lab.id }, 2);
  const courseById = new Map<CourseId, Course>([
    [LECTURE_COURSE.id, LECTURE_COURSE],
    [lab.id, lab],
  ]);
  return creditsOfBundle([LECTURE, labSection], courseById);
}

describe('creditsOfBundle', () => {
  it('counts no credits for a lab included in its lecture', () => {
    const lab = labCourse(LECTURE_COURSE.id);

    expect(creditsWithLab(lab)).toEqual([
      { course: LECTURE_COURSE, countsCredits: true },
      { course: lab, countsCredits: false },
    ]);
  });

  it('counts a lab that awards its own credits', () => {
    expect(creditsWithLab(labCourse(null))[1]?.countsCredits).toBe(true);
  });

  it('counts a lab whose credits are included in a course outside the bundle', () => {
    const elsewhere = buildCourse({}, 9).id;

    expect(creditsWithLab(labCourse(elsewhere))[1]?.countsCredits).toBe(true);
  });

  it('leaves an omitted inclusion unknown when another course could include it', () => {
    expect(creditsWithLab(labCourse(undefined))[1]?.countsCredits).toBeNull();
  });

  it('counts a lone course with an omitted inclusion, since nothing in the bundle includes it', () => {
    const lone = buildCourse({ creditsIncludedInCourseId: undefined }, 1);

    expect(creditsOfBundle([LECTURE], new Map([[lone.id, lone]]))).toEqual([
      { course: lone, countsCredits: true },
    ]);
  });

  it("throws courseMissing when a section's course isn't supplied", () => {
    expect(() => creditsOfBundle([LECTURE], new Map())).toThrow(
      new ScheduleInputError('courseMissing'),
    );
  });
});

describe('toBundleCourseSelections', () => {
  const policy = buildAcademicPolicy({
    termCreditBounds: { minCreditsHundredths: 0, maxCreditsHundredths: 1800 },
  });

  it('counts a 3-credit lecture with an included 1-credit lab as 3 credits', () => {
    const credits = creditsWithLab(labCourse(LECTURE_COURSE.id));

    const result = toBundleCourseSelections([{ credits }], new Map());

    expect(result.isKnown).toBe(true);
    const selections = result.isKnown ? result.selections : [];
    expect(checkCreditLoad(selections, policy).evidence?.creditLoad).toEqual({
      totalCreditsHundredths: 300,
      minCreditsHundredths: 0,
      maxCreditsHundredths: 1800,
    });
  });

  it('passes the chosen value of a variable-credit course', () => {
    const variable = buildVariableCreditCourse({}, 3);

    const result = toBundleCourseSelections(
      [{ credits: [{ course: variable, countsCredits: true }] }],
      new Map([[variable.id, 200]]),
    );

    expect(result).toEqual({
      isKnown: true,
      selections: [{ course: variable, selectedCreditsHundredths: 200, countsCredits: true }],
    });
  });

  it('names the courses whose inclusion is unknown instead of any selections', () => {
    const lab = labCourse(undefined);

    expect(toBundleCourseSelections([{ credits: creditsWithLab(lab) }], new Map())).toEqual({
      isKnown: false,
      unknownCourseIds: [lab.id],
    });
  });
});
