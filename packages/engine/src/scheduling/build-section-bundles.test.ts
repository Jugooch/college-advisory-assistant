/**
 * @file Tests for building a course's section bundles from its sections and linked groups (AC06).
 */
import { describe, expect, it } from 'vitest';

import { type LinkedSectionGroup, type MeetingPattern, type Section, Weekday } from '@caa/domain';
import {
  buildCourse,
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  buildMeetingPattern,
  buildSection,
  buildTbaMeeting,
} from '@caa/test-kit';

import { buildSectionBundles, type SectionBundles } from './build-section-bundles';
import { ScheduleInputError } from './schedule-input-error';

const { Tuesday, Thursday, Friday } = Weekday;
const LECTURE_COURSE = buildCourse({}, 1);
const LAB_COURSE = buildCourse(
  { creditsHundredths: 100, creditsIncludedInCourseId: LECTURE_COURSE.id },
  2,
);
const PASS = { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' };

/**
 * Builds a lab meeting on one weekday afternoon.
 *
 * @param weekday - The lab's day.
 * @param startTime - Local start time; 14:00 by default.
 * @returns The meeting.
 */
function lab(weekday: Weekday, startTime = '14:00'): MeetingPattern {
  return buildMeetingPattern({ weekdays: [weekday], startTime, endTime: '15:50' });
}

/** DEMO-PHYS 301 001 (MWF 09:00), lab L01 (Tuesday) and lab L02 (Thursday). */
const LECTURE = buildSection({}, 1);
const L01 = buildSection({ courseId: LAB_COURSE.id, meetings: [lab(Tuesday)] }, 2);
const L02 = buildSection({ courseId: LAB_COURSE.id, meetings: [lab(Thursday)] }, 3);

/**
 * Builds the bundles of the lecture course from the given sections and groups.
 *
 * @param sections - The snapshot's sections.
 * @param linkedSectionGroups - The snapshot's linked groups; the lecture's lab group by default.
 * @returns What building found.
 */
function bundlesOf(
  sections: readonly Section[],
  linkedSectionGroups: readonly LinkedSectionGroup[] = [buildLinkedSectionGroup()],
): SectionBundles {
  return buildSectionBundles({
    course: LECTURE_COURSE,
    snapshot: { sections, linkedSectionGroups },
    linkedCourses: [LAB_COURSE],
    transitionPolicy: null,
  });
}

/**
 * Builds the reviewer's nested setup: the lecture requires lab L01 and one recitation, and
 * L01 requires one of the same recitations.
 *
 * @param recitationIds - The permitted recitations, in the order the groups list them.
 * @returns The lecture's group and L01's group.
 */
function nestedRecitationGroups(recitationIds: readonly string[]): LinkedSectionGroup[] {
  const recitation = buildLinkedSectionComponent({
    name: 'Recitation',
    permittedSectionIds: recitationIds,
  });
  return [
    buildLinkedSectionGroup({
      components: [buildLinkedSectionComponent({ permittedSectionIds: [L01.id] }), recitation],
    }),
    buildLinkedSectionGroup({ primarySectionId: L01.id, components: [recitation] }, 2),
  ];
}

/**
 * Lists each bundle's section IDs.
 *
 * @param bundles - The bundles.
 * @returns The IDs per bundle.
 */
function idsOf(bundles: readonly { readonly sections: readonly Section[] }[]): string[][] {
  return bundles.map((bundle) => bundle.sections.map((section) => section.id));
}

describe('buildSectionBundles linked labs', () => {
  it('gives two bundles for DEMO-PHYS 301 001 with labs L01 and L02', () => {
    const result = bundlesOf([LECTURE, L01, L02]);

    expect(idsOf(result.bundles)).toEqual([
      [LECTURE.id, L01.id],
      [LECTURE.id, L02.id],
    ]);
    expect(result.bundles[0]).toEqual({
      courseId: LECTURE_COURSE.id,
      sections: [LECTURE, L01],
      courses: [LECTURE_COURSE, LAB_COURSE],
      feasibility: PASS,
    });
    expect(result.blocked).toEqual([]);
    expect(result.unavailable).toBeNull();
  });

  it('blocks a bundle whose lab conflicts with its own lecture, with FAIL evidence (AC06)', () => {
    const clashing = buildSection(
      { courseId: LAB_COURSE.id, meetings: [buildMeetingPattern({ startTime: '09:30' })] },
      2,
    );

    const result = bundlesOf([LECTURE, clashing, L02]);

    expect(idsOf(result.bundles)).toEqual([[LECTURE.id, L02.id]]);
    expect(idsOf(result.blocked)).toEqual([[LECTURE.id, clashing.id]]);
    expect(result.blocked[0]?.feasibility).toMatchObject({
      state: 'FAIL',
      reasonCode: 'MEETING_CONFLICT',
    });
  });

  it('keeps a bundle with a TBA lab as UNKNOWN, never PASS', () => {
    const tba = buildSection({ courseId: LAB_COURSE.id, meetings: [buildTbaMeeting()] }, 2);

    const result = bundlesOf([LECTURE, tba]);

    expect(idsOf(result.bundles)).toEqual([[LECTURE.id, tba.id]]);
    expect(result.bundles[0]?.feasibility).toMatchObject({
      state: 'UNKNOWN',
      reasonCode: 'MEETING_TIME_UNKNOWN',
    });
  });

  it('gives a deep-equal result for shuffled sections and permitted IDs', () => {
    const shuffledGroup = buildLinkedSectionGroup({
      components: [buildLinkedSectionComponent({ permittedSectionIds: [L02.id, L01.id] })],
    });

    expect(bundlesOf([L02, LECTURE, L01], [shuffledGroup])).toEqual(bundlesOf([LECTURE, L01, L02]));
  });

  it('gives one bundle per section, sorted by ID, for a course with no linked group', () => {
    const second = buildSection({}, 4);

    const result = bundlesOf([second, LECTURE], []);

    expect(idsOf(result.bundles)).toEqual([[LECTURE.id], [second.id]]);
    expect(result.bundles[0]?.courses).toEqual([LECTURE_COURSE]);
  });
});

describe('buildSectionBundles unavailable components', () => {
  it('is UNKNOWN LINKED_SECTION_UNAVAILABLE for a component with no permitted section', () => {
    const group = buildLinkedSectionGroup({
      components: [buildLinkedSectionComponent({ permittedSectionIds: [] })],
    });

    const result = bundlesOf([LECTURE], [group]);

    expect(result.bundles).toEqual([]);
    expect(result.unavailable).toEqual({
      kind: 'SCHEDULE_FEASIBILITY',
      state: 'UNKNOWN',
      reasonCode: 'LINKED_SECTION_UNAVAILABLE',
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        scheduleIssues: [
          {
            reasonCode: 'LINKED_SECTION_UNAVAILABLE',
            primarySectionId: LECTURE.id,
            componentName: 'Lab',
            courseId: LAB_COURSE.id,
          },
        ],
      },
    });
  });

  it('never leaves the lab out when its permitted sections are not published', () => {
    const result = bundlesOf([LECTURE]);

    expect(result.bundles).toEqual([]);
    expect(result.unavailable?.reasonCode).toBe('LINKED_SECTION_UNAVAILABLE');
  });

  it('drops a section with an unavailable component and keeps the others', () => {
    const recitation = buildLinkedSectionComponent({ name: 'Recitation', permittedSectionIds: [] });
    const blocked = buildLinkedSectionGroup({
      primarySectionId: L01.id,
      components: [{ ...recitation, courseId: LAB_COURSE.id }],
    });
    const result = bundlesOf([LECTURE, L01, L02], [buildLinkedSectionGroup(), blocked]);

    expect(idsOf(result.bundles)).toEqual([[LECTURE.id, L02.id]]);
    expect(result.unavailable?.evidence?.scheduleIssues).toEqual([
      expect.objectContaining({ primarySectionId: L01.id, componentName: 'Recitation' }),
    ]);
  });
});

describe('buildSectionBundles nested and same-course links', () => {
  it('takes a same-course recitation only with its lecture, never on its own', () => {
    const recitation = buildSection({ meetings: [lab(Tuesday)] }, 5);
    const group = buildLinkedSectionGroup({
      components: [
        buildLinkedSectionComponent({
          name: 'Recitation',
          courseId: LECTURE_COURSE.id,
          permittedSectionIds: [recitation.id],
        }),
      ],
    });

    const result = bundlesOf([LECTURE, recitation], [group]);

    expect(idsOf(result.bundles)).toEqual([[LECTURE.id, recitation.id]]);
    expect(result.bundles[0]?.courses).toEqual([LECTURE_COURSE]);
  });

  it('expands a linked section that requires its own linked section, each section once', () => {
    const recitation = buildSection({ courseId: LAB_COURSE.id, meetings: [lab(Thursday)] }, 6);
    const lectureGroup = buildLinkedSectionGroup({
      components: [
        buildLinkedSectionComponent({ permittedSectionIds: [L01.id] }),
        buildLinkedSectionComponent({ name: 'Recitation', permittedSectionIds: [recitation.id] }),
      ],
    });
    const labGroup = buildLinkedSectionGroup(
      {
        primarySectionId: L01.id,
        components: [
          buildLinkedSectionComponent({ name: 'Recitation', permittedSectionIds: [recitation.id] }),
        ],
      },
      2,
    );

    const result = bundlesOf([LECTURE, L01, recitation], [lectureGroup, labGroup]);

    expect(idsOf(result.bundles)).toEqual([[LECTURE.id, L01.id, recitation.id]]);
  });

  it('never bundles two sections of one component reached through nested groups', () => {
    const r1 = buildSection({ courseId: LAB_COURSE.id, meetings: [lab(Thursday)] }, 6);
    const r2 = buildSection({ courseId: LAB_COURSE.id, meetings: [lab(Friday)] }, 7);

    const result = bundlesOf([LECTURE, L01, r1, r2], nestedRecitationGroups([r1.id, r2.id]));

    expect(idsOf(result.bundles)).toEqual([
      [LECTURE.id, L01.id, r1.id],
      [LECTURE.id, L01.id, r2.id],
    ]);
  });

  it('gives a deep-equal result for nested groups whatever the input order', () => {
    const r1 = buildSection({ courseId: LAB_COURSE.id, meetings: [lab(Thursday)] }, 6);
    const r2 = buildSection({ courseId: LAB_COURSE.id, meetings: [lab(Friday)] }, 7);

    expect(bundlesOf([r2, L01, r1, LECTURE], nestedRecitationGroups([r2.id, r1.id]))).toEqual(
      bundlesOf([LECTURE, L01, r1, r2], nestedRecitationGroups([r1.id, r2.id])),
    );
  });

  it('throws linkCycle when linked groups require each other', () => {
    const back = buildLinkedSectionGroup(
      {
        primarySectionId: L01.id,
        components: [
          buildLinkedSectionComponent({
            courseId: LECTURE_COURSE.id,
            permittedSectionIds: [LECTURE.id],
          }),
        ],
      },
      2,
    );
    const forward = buildLinkedSectionGroup({
      components: [buildLinkedSectionComponent({ permittedSectionIds: [L01.id] })],
    });

    expect(() => bundlesOf([LECTURE, L01], [forward, back])).toThrow(
      new ScheduleInputError('linkCycle'),
    );
  });

  it("throws courseMissing when a linked section's course isn't supplied", () => {
    expect(() =>
      buildSectionBundles({
        course: LECTURE_COURSE,
        snapshot: { sections: [LECTURE, L01], linkedSectionGroups: [buildLinkedSectionGroup()] },
        linkedCourses: [],
        transitionPolicy: null,
      }),
    ).toThrow(new ScheduleInputError('courseMissing'));
  });
});
