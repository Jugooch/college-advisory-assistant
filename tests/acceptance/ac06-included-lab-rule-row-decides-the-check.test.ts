/**
 * @file Acceptance AC06 (second file): an included lab with no rule row is UNKNOWN
 * `LINKED_COURSE_NOT_CHECKED` and holds the option at NEEDS_VERIFICATION, while one with an
 * explicit `NONE` rule needs no check and leaves the option VALIDATED (ADR-0012 §1; ADR-0010
 * Amendment 4). Through `POST /v1/students/:studentId/schedule-options`.
 * @requirement FR-05
 * @requirement FR-06
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0012-explicit-no-prerequisite-and-repeat-credit.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { Weekday } from '@caa/domain';
import {
  buildCourse,
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  buildMeetingPattern,
  buildPrerequisiteRule,
  buildSection,
  none,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { acceptanceIt } from '../support/known-findings';
import {
  findScheduleOptions,
  publishSections,
  resetScheduleWorld,
  scheduleRequest,
} from '../support/schedule-options-harness';

const { phys201 } = SYNTHETIC_COURSES;
/** DEMO-PHYS 201M: a 1.00-credit lab whose credits are included in DEMO-PHYS 201. */
const includedLab = buildCourse(
  { label: 'DEMO-PHYS 201M', creditsHundredths: 100, creditsIncludedInCourseId: phys201.id },
  31,
);
/** DEMO-PHYS 201 section 001: MWF 09:00–09:50 all term. */
const LECTURE = buildSection({ courseId: phys201.id }, 11);
/** Lab L02: Thursday 13:00–15:50, clear of the lecture. */
const LAB = buildSection(
  {
    courseId: includedLab.id,
    sectionCode: 'L02',
    meetings: [
      buildMeetingPattern({ weekdays: [Weekday.Thursday], startTime: '13:00', endTime: '15:50' }),
    ],
  },
  14,
);
/** The lecture states no prerequisite, so only the lab's rule row varies. */
const LECTURE_NONE = buildPrerequisiteRule({ courseId: phys201.id, expression: none() }, 2);

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC06 the rule row of an included lab decides whether it is checked', () => {
  beforeEach(() => {
    resetScheduleWorld(world);
    world.courses = [...Object.values(SYNTHETIC_COURSES), includedLab];
    publishSections(world, [LECTURE, LAB], {
      linkedSectionGroups: [
        buildLinkedSectionGroup({
          primarySectionId: LECTURE.id,
          components: [
            buildLinkedSectionComponent({
              courseId: includedLab.id,
              permittedSectionIds: [LAB.id],
            }),
          ],
        }),
      ],
    });
  });

  acceptanceIt(
    'AC06',
    'needs verification when an included lab has no rule row, never skipping its check',
    async () => {
      // NOTE: the lab's rule row is removed explicitly, so a default `NONE` can't mask it.
      world.rules = [
        ...(world.rules ?? []).filter((rule) => rule.courseId !== includedLab.id),
        LECTURE_NONE,
      ];
      expect(world.rules.some((rule) => rule.courseId === includedLab.id)).toBe(false);

      const response = await findScheduleOptions(app, scheduleRequest([phys201.id]));

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            outcome: 'OPTIONS_FOUND',
            options: [
              {
                rank: 1,
                aggregate: 'NEEDS_VERIFICATION',
                bundles: [{ courseId: phys201.id, creditsCountedHundredths: 400 }],
                linkedCourseResults: [
                  {
                    courseId: includedLab.id,
                    prerequisite: { state: 'UNKNOWN', reasonCode: 'LINKED_COURSE_NOT_CHECKED' },
                    applicability: { state: 'UNKNOWN', reasonCode: 'LINKED_COURSE_NOT_CHECKED' },
                  },
                ],
              },
            ],
          },
        },
      });
    },
  );

  acceptanceIt(
    'AC06',
    'leaves the option validated when an included lab has an explicit NONE rule',
    async () => {
      world.rules = [
        ...(world.rules ?? []),
        LECTURE_NONE,
        buildPrerequisiteRule({ courseId: includedLab.id, expression: none() }, 3),
      ];

      const response = await findScheduleOptions(app, scheduleRequest([phys201.id]));

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            outcome: 'OPTIONS_FOUND',
            options: [{ rank: 1, aggregate: 'VALIDATED', linkedCourseResults: [] }],
          },
        },
      });
    },
  );
});
