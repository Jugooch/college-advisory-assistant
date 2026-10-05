/**
 * @file Acceptance AC33 (proposed, #225): schedule options pin every input they were computed from
 * and replay deep-equal, and missing or unreliable section data is referred, never guessed
 * (ADR-0010 §6 and §7). The pinned inputs include the section snapshot, the transition table
 * version, the work cap, and a hash of the normalized request. A requested course with no
 * section is 200 `NEEDS_VERIFICATION`; no published snapshot is 503; a tie for the latest
 * snapshot is 409; a snapshot exactly 24 hours old is still fresh.
 * @requirement FR-07
 * @requirement FR-18
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { Weekday } from '@caa/domain';
import {
  buildMeetingPattern,
  buildSection,
  buildSectionSnapshot,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { summarizeError } from '../support/api-harness';
import { acceptanceIt } from '../support/known-findings';
import {
  findScheduleOptions,
  pinnedField,
  publishSections,
  publishTransitions,
  resetScheduleWorld,
  scheduleRequest,
  SECTIONS_AT,
} from '../support/schedule-options-harness';

const { math102, phys201 } = SYNTHETIC_COURSES;
/** DEMO-MATH 102, MWF 09:00–09:50. */
const MATH_MWF = buildSection({ courseId: math102.id }, 61);
/** DEMO-PHYS 201, TTh 09:00–09:50, compatible with {@link MATH_MWF}. */
const PHYS_TTH = buildSection(
  {
    courseId: phys201.id,
    meetings: [buildMeetingPattern({ weekdays: [Weekday.Tuesday, Weekday.Thursday] })],
  },
  62,
);
const BOTH = scheduleRequest([math102.id, phys201.id]);

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC33 schedule options are pinned and refer missing section data', () => {
  beforeEach(() => {
    resetScheduleWorld(world);
    publishSections(world, [MATH_MWF, PHYS_TTH]);
    publishTransitions(world, []);
  });

  acceptanceIt(
    'AC33',
    'pins the section snapshot, transition version, work cap, and request hash',
    async () => {
      const response = await findScheduleOptions(app, BOTH);

      expect(response).toMatchObject({
        statusCode: 200,
        body: {
          data: {
            outcome: 'OPTIONS_FOUND',
            pinnedInputs: {
              studentSnapshotId: 'a0000000-0000-4000-8000-000000000001',
              rulesetVersion: 'demo-2026.1',
              sectionSnapshotId: 'c2000000-0000-4000-8000-000000000001',
              campusTransitionVersion: 'demo-2026.1',
              solverWorkCap: 3_000_000,
            },
          },
        },
      });
      expect(pinnedField(response, 'constraintHash')).toMatch(/^sha256:[0-9a-f]{64}$/);
    },
  );

  acceptanceIt('AC33', 'replays the same request on unchanged inputs deep-equal', async () => {
    const first = await findScheduleOptions(app, BOTH);
    const second = await findScheduleOptions(app, BOTH);

    expect(first.statusCode).toBe(200);
    expect(second).toEqual(first);
  });

  acceptanceIt(
    'AC33',
    'hashes the same request with its courses in another order the same',
    async () => {
      const forward = await findScheduleOptions(app, BOTH);
      const reversed = await findScheduleOptions(app, scheduleRequest([phys201.id, math102.id]));
      expect(forward.statusCode).toBe(200);
      expect(pinnedField(forward, 'constraintHash')).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(pinnedField(reversed, 'constraintHash')).toBe(pinnedField(forward, 'constraintHash'));
    },
  );

  acceptanceIt('AC33', 'needs verification when a requested course has no section', async () => {
    publishSections(world, [MATH_MWF]);

    const response = await findScheduleOptions(app, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          outcome: 'NEEDS_VERIFICATION',
          searchComplete: false,
          options: [],
          conflictSet: null,
          unresolved: [
            { kind: 'SCHEDULE_FEASIBILITY', state: 'UNKNOWN', reasonCode: 'SECTION_DATA_MISSING' },
          ],
        },
      },
    });
  });

  acceptanceIt(
    'AC33',
    'is 503 SOURCE_UNAVAILABLE when the term has no published snapshot',
    async () => {
      world.sectionSnapshots = [];

      const response = await findScheduleOptions(app, BOTH);

      expect(summarizeError(response)).toMatchObject({
        statusCode: 503,
        bodyKeys: ['error'],
        code: 'SOURCE_UNAVAILABLE',
      });
    },
  );

  acceptanceIt('AC33', 'refers a tie for the latest snapshot with 409 STALE_SOURCE', async () => {
    world.sectionSnapshots = [
      buildSectionSnapshot({ sections: [MATH_MWF, PHYS_TTH], sourceEffectiveAt: SECTIONS_AT }, 1),
      buildSectionSnapshot({ sections: [MATH_MWF], sourceEffectiveAt: SECTIONS_AT }, 2),
    ];

    const response = await findScheduleOptions(app, BOTH);

    expect(summarizeError(response)).toMatchObject({
      statusCode: 409,
      bodyKeys: ['error'],
      code: 'STALE_SOURCE',
    });
  });

  acceptanceIt('AC33', 'still serves a snapshot exactly 24 hours old', async () => {
    publishSections(world, [MATH_MWF, PHYS_TTH], { sourceEffectiveAt: '2026-08-31T12:00:00.000Z' });

    const response = await findScheduleOptions(app, BOTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: { data: { outcome: 'OPTIONS_FOUND' } },
    });
  });
});
