/**
 * @file Tests that each solver option carries its unchecked linked courses (ADR-0010 Amendment 4).
 */
import { describe, expect, it } from 'vitest';

import { type Course, CourseIdSchema, createPrerequisiteRootExpression } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildCourse,
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  buildMeetingPattern,
  buildPrerequisiteRule,
  buildSection,
} from '@caa/test-kit';

import { buildSectionBundles } from './build-section-bundles';
import type { LinkedCourseRule } from './linked-course-results';
import type { ScheduleSolution } from './schedule-solution';
import { solveSchedule } from './solve-schedule';

const PHYS_201_ID = CourseIdSchema.parse('3c4d5e6f-0000-4000-8000-000000000201');
const LAB_ID = '3c4d5e6f-0000-4000-8000-00000000020a';
const PHYS_201 = buildCourse({ id: PHYS_201_ID, label: 'DEMO-PHYS 201' }, 1);
const POLICY = buildAcademicPolicy({
  termCreditBounds: { minCreditsHundredths: 0, maxCreditsHundredths: 3000 },
});

/**
 * Solves PHYS 201 with one lecture that requires one lab section of a lab course.
 *
 * @param lab - The lab course.
 * @param prerequisiteRules - The rules passed to the solver.
 * @returns The solution.
 */
function solveWithLab(
  lab: Course,
  prerequisiteRules: readonly LinkedCourseRule[] = [],
): ScheduleSolution {
  const lecture = buildSection(
    { courseId: PHYS_201_ID, meetings: [buildMeetingPattern({ startTime: '09:00' })] },
    1,
  );
  const labSection = buildSection(
    {
      courseId: lab.id,
      meetings: [buildMeetingPattern({ startTime: '13:00', endTime: '13:50' })],
    },
    2,
  );
  const group = buildLinkedSectionGroup({
    primarySectionId: lecture.id,
    components: [
      buildLinkedSectionComponent({ courseId: lab.id, permittedSectionIds: [labSection.id] }),
    ],
  });
  const bundles = buildSectionBundles({
    course: PHYS_201,
    snapshot: { sections: [lecture, labSection], linkedSectionGroups: [group] },
    linkedCourses: [lab],
    transitionPolicy: null,
  });
  return solveSchedule({
    requests: [{ courseId: PHYS_201_ID, bundles }],
    selectedCredits: new Map(),
    policy: POLICY,
    constraints: [],
    transitionPolicy: null,
    prerequisiteRules,
    workCap: 3_000_000,
  });
}

const NOT_CHECKED = {
  kind: 'PREREQUISITE',
  state: 'UNKNOWN',
  reasonCode: 'LINKED_COURSE_NOT_CHECKED',
};

describe('solveSchedule linked course results (ADR-0010 Amendment 4)', () => {
  it('adds UNKNOWN results for a lab whose credits count on their own', () => {
    const lab = buildCourse({ id: LAB_ID, creditsHundredths: 100 }, 2);

    const solution = solveWithLab(lab);

    expect(solution.options.map((option) => option.linkedCourseResults)).toEqual([
      [
        {
          courseId: LAB_ID,
          prerequisite: NOT_CHECKED,
          applicability: { ...NOT_CHECKED, kind: 'REQUIREMENT_APPLICABILITY' },
        },
      ],
    ]);
  });

  it('adds none for a lab included in PHYS 201 with no prerequisite of its own', () => {
    const lab = buildCourse(
      { id: LAB_ID, creditsHundredths: 100, creditsIncludedInCourseId: PHYS_201_ID },
      2,
    );

    expect(solveWithLab(lab).options.map((option) => option.linkedCourseResults)).toEqual([[]]);
  });

  it('adds none for a lab included in PHYS 201 whose rule states no prerequisite', () => {
    const lab = buildCourse(
      { id: LAB_ID, creditsHundredths: 100, creditsIncludedInCourseId: PHYS_201_ID },
      2,
    );
    const noneRule = {
      courseId: lab.id,
      expression: createPrerequisiteRootExpression({ type: 'NONE' }),
    };

    expect(
      solveWithLab(lab, [noneRule]).options.map((option) => option.linkedCourseResults),
    ).toEqual([[]]);
  });

  it('adds UNKNOWN results for an included lab with its own prerequisite rule', () => {
    const lab = buildCourse(
      { id: LAB_ID, creditsHundredths: 100, creditsIncludedInCourseId: PHYS_201_ID },
      2,
    );

    const solution = solveWithLab(lab, [buildPrerequisiteRule({ courseId: LAB_ID })]);

    expect(solution.options.map((option) => option.linkedCourseResults)).toEqual([
      [
        {
          courseId: LAB_ID,
          prerequisite: NOT_CHECKED,
          applicability: { ...NOT_CHECKED, kind: 'REQUIREMENT_APPLICABILITY' },
        },
      ],
    ]);
  });
});
