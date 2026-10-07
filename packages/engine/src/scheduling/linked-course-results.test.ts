/**
 * @file Tests for selecting an option's unchecked linked courses (ADR-0010 Amendment 4).
 */
import { describe, expect, it } from 'vitest';

import {
  type Course,
  CourseIdSchema,
  createPrerequisiteRootExpression,
  type Section,
} from '@caa/domain';
import { buildCourse, buildPrerequisiteRule, buildSection } from '@caa/test-kit';

import { type LinkedCourseInput, linkedCourseResultsOf } from './linked-course-results';
import { ScheduleInputError } from './schedule-input-error';

const PHYS_201_ID = CourseIdSchema.parse('3c4d5e6f-0000-4000-8000-000000000201');
const CHEM_101_ID = CourseIdSchema.parse('3c4d5e6f-0000-4000-8000-000000000101');
const LAB_B_ID = CourseIdSchema.parse('3c4d5e6f-0000-4000-8000-00000000020b');
const LAB_A_ID = CourseIdSchema.parse('3c4d5e6f-0000-4000-8000-00000000020a');
const OUTSIDE_ID = CourseIdSchema.parse('3c4d5e6f-0000-4000-8000-000000000999');

const PHYS_201 = buildCourse({ id: PHYS_201_ID, label: 'DEMO-PHYS 201' }, 1);
const CHEM_101 = buildCourse({ id: CHEM_101_ID, label: 'DEMO-CHEM 101' }, 2);

/** An explicit "no prerequisite" rule expression (ADR-0012 §1). */
const NO_PREREQUISITE = createPrerequisiteRootExpression({ type: 'NONE' });

/** The results every selected course gets: both checks UNKNOWN, unverified. */
const NOT_CHECKED = {
  prerequisite: {
    kind: 'PREREQUISITE',
    state: 'UNKNOWN',
    reasonCode: 'LINKED_COURSE_NOT_CHECKED',
  },
  applicability: {
    kind: 'REQUIREMENT_APPLICABILITY',
    state: 'UNKNOWN',
    reasonCode: 'LINKED_COURSE_NOT_CHECKED',
  },
};

/**
 * Builds a 1.00-credit lab course.
 *
 * @param id - Its course ID.
 * @param creditsIncludedInCourseId - The course that includes its credits, or `null`.
 * @param seed - The builder seed.
 * @returns The lab course.
 */
function labCourse(id: string, creditsIncludedInCourseId: string | null, seed: number): Course {
  return buildCourse({ id, creditsHundredths: 100, creditsIncludedInCourseId }, seed);
}

/**
 * Builds a section of a course.
 *
 * @param course - The course.
 * @param seed - The section seed.
 * @returns The section.
 */
function sectionOf(course: Course, seed: number): Section {
  return buildSection({ courseId: course.id }, seed);
}

/**
 * Builds the input for one bundle of PHYS 201 with the given linked courses.
 *
 * @param linked - The linked courses, one section each.
 * @param overrides - Fields to replace.
 * @returns The input.
 */
function physWith(
  linked: readonly Course[],
  overrides: Partial<LinkedCourseInput> = {},
): LinkedCourseInput {
  return {
    bundles: [
      {
        sections: [sectionOf(PHYS_201, 1), ...linked.map((course, i) => sectionOf(course, i + 2))],
      },
    ],
    requestedCourseIds: [PHYS_201.id],
    courses: [PHYS_201, ...linked],
    prerequisiteRules: [],
    ...overrides,
  };
}

describe('linkedCourseResultsOf', () => {
  it('lists a lab whose credits are not included, with two UNKNOWN results', () => {
    const lab = labCourse(LAB_A_ID, null, 3);

    expect(linkedCourseResultsOf(physWith([lab]))).toEqual([
      { courseId: LAB_A_ID, ...NOT_CHECKED },
    ]);
  });

  it('lists nothing for a lab included in PHYS 201 with no prerequisite of its own', () => {
    const lab = labCourse(LAB_A_ID, PHYS_201_ID, 3);

    expect(linkedCourseResultsOf(physWith([lab]))).toEqual([]);
  });

  it('lists an included lab that has its own prerequisite rule', () => {
    const lab = labCourse(LAB_A_ID, PHYS_201_ID, 3);
    const rules = [buildPrerequisiteRule({ courseId: LAB_A_ID })];

    expect(linkedCourseResultsOf(physWith([lab], { prerequisiteRules: rules }))).toEqual([
      { courseId: LAB_A_ID, ...NOT_CHECKED },
    ]);
  });

  it('lists nothing for a lab included in PHYS 201 whose rule states no prerequisite', () => {
    const lab = labCourse(LAB_A_ID, PHYS_201_ID, 3);
    const rules = [{ courseId: LAB_A_ID, expression: NO_PREREQUISITE }];

    expect(linkedCourseResultsOf(physWith([lab], { prerequisiteRules: rules }))).toEqual([]);
  });

  it('still lists a lab with a NONE rule when its credits are not included', () => {
    const lab = labCourse(LAB_A_ID, null, 3);
    const rules = [{ courseId: LAB_A_ID, expression: NO_PREREQUISITE }];

    expect(linkedCourseResultsOf(physWith([lab], { prerequisiteRules: rules }))).toEqual([
      { courseId: LAB_A_ID, ...NOT_CHECKED },
    ]);
  });

  it('ignores a rule for a course that is not in the option', () => {
    const lab = labCourse(LAB_A_ID, PHYS_201_ID, 3);
    const rules = [buildPrerequisiteRule({ courseId: OUTSIDE_ID })];

    expect(linkedCourseResultsOf(physWith([lab], { prerequisiteRules: rules }))).toEqual([]);
  });

  it('lists a lab whose credits are included in a course outside the plan', () => {
    const lab = labCourse(LAB_A_ID, OUTSIDE_ID, 3);

    expect(linkedCourseResultsOf(physWith([lab]))).toEqual([
      { courseId: LAB_A_ID, ...NOT_CHECKED },
    ]);
  });

  it('never lists a requested course, even one with its own credits and rule', () => {
    const input: LinkedCourseInput = {
      bundles: [{ sections: [sectionOf(PHYS_201, 1)] }, { sections: [sectionOf(CHEM_101, 2)] }],
      requestedCourseIds: [PHYS_201_ID, CHEM_101_ID],
      courses: [PHYS_201, CHEM_101],
      prerequisiteRules: [buildPrerequisiteRule({ courseId: CHEM_101_ID })],
    };

    expect(linkedCourseResultsOf(input)).toEqual([]);
  });

  it('never lists a requested course that another bundle links', () => {
    const input: LinkedCourseInput = {
      bundles: [
        { sections: [sectionOf(PHYS_201, 1), sectionOf(CHEM_101, 2)] },
        { sections: [sectionOf(CHEM_101, 3)] },
      ],
      requestedCourseIds: [PHYS_201_ID, CHEM_101_ID],
      courses: [PHYS_201, CHEM_101],
      prerequisiteRules: [],
    };

    expect(linkedCourseResultsOf(input)).toEqual([]);
  });

  it('sorts by course ID and lists a course linked by two bundles once', () => {
    const labB = labCourse(LAB_B_ID, null, 3);
    const labA = labCourse(LAB_A_ID, null, 4);
    const input: LinkedCourseInput = {
      bundles: [
        { sections: [sectionOf(PHYS_201, 1), sectionOf(labB, 2)] },
        { sections: [sectionOf(CHEM_101, 3), sectionOf(labB, 4), sectionOf(labA, 5)] },
      ],
      requestedCourseIds: [PHYS_201_ID, CHEM_101_ID],
      courses: [PHYS_201, CHEM_101, labB, labA],
      prerequisiteRules: [],
    };

    expect(linkedCourseResultsOf(input)).toEqual([
      { courseId: LAB_A_ID, ...NOT_CHECKED },
      { courseId: LAB_B_ID, ...NOT_CHECKED },
    ]);
  });

  it('gives a deep-equal result for shuffled input', () => {
    const labB = labCourse(LAB_B_ID, null, 3);
    const labA = labCourse(LAB_A_ID, PHYS_201_ID, 4);
    const rules = [buildPrerequisiteRule({ courseId: LAB_A_ID })];
    const forward = physWith([labA, labB], { prerequisiteRules: rules });
    const shuffled: LinkedCourseInput = {
      bundles: [{ sections: [...(forward.bundles[0]?.sections ?? [])].reverse() }],
      requestedCourseIds: [PHYS_201_ID],
      courses: [...forward.courses].reverse(),
      prerequisiteRules: rules,
    };

    expect(linkedCourseResultsOf(shuffled)).toEqual(linkedCourseResultsOf(forward));
    expect(linkedCourseResultsOf(forward).map((result) => result.courseId)).toEqual([
      LAB_A_ID,
      LAB_B_ID,
    ]);
  });

  it('throws courseMissing when a section names a course the catalog lacks', () => {
    const lab = labCourse(LAB_A_ID, null, 3);

    expect(() => linkedCourseResultsOf(physWith([lab], { courses: [PHYS_201] }))).toThrow(
      new ScheduleInputError('courseMissing'),
    );
  });
});
