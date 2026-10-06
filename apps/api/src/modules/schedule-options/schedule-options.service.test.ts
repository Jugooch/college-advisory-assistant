/**
 * @file Tests for the schedule options service: options on pinned inputs, the section freshness
 * gate, missing and tied snapshots, missing sections, TBA meetings, the work cap, replay, request
 * errors, access, and ID-only logging.
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-10
 * @requirement NFR-01
 * @requirement NFR-04
 * @requirement NFR-07
 */
import { describe, expect, it } from 'vitest';

import { ScheduleOptionsResponseSchema } from '@caa/api-contract';
import { CheckState, ReasonCode, ScheduleOutcome } from '@caa/domain';
import {
  buildCourse,
  buildCreditRange,
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  buildMeetingPattern,
  buildPrerequisiteRule,
  buildSection,
  buildSectionSnapshot,
  buildTbaMeeting,
  course,
  HARD_STRENGTH,
} from '@caa/test-kit';

import {
  InvalidRequestError,
  NotFoundError,
  SourceUnavailableError,
  StaleSourceError,
} from '../../shared/domain-errors';
import {
  buildScheduleSnapshot,
  droppedSectionStore,
  runScheduleOptions as find,
  SCHEDULE_SECTIONS as SECTIONS,
  scheduleRequest,
  scheduleStore,
} from '../../testing/schedule-options-harness';
import { SEED_COURSES } from '../../testing/seed-scenario-fixtures';

const { math101, math102, phys301, phys301Lab } = SEED_COURSES;

describe('ScheduleOptionsService.findOptions', () => {
  it('gives two contract-valid options for the four seeded courses, pinned to every input', async () => {
    const response = await find(scheduleRequest()).result;

    expect(ScheduleOptionsResponseSchema.safeParse(response).success).toBe(true);
    expect(response).toMatchObject({
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      conflictSet: null,
      unresolved: [],
      pinnedInputs: {
        rulesetVersion: 'demo-2026.1',
        sectionSnapshotId: buildScheduleSnapshot().id,
        campusTransitionVersion: null,
        solverWorkCap: 3_000_000,
      },
    });
    expect(response.options.map((option) => option.rank)).toEqual([1, 2]);
    expect(response.pinnedInputs.constraintHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('gives deep-equal responses when the same request is replayed', async () => {
    expect(await find(scheduleRequest()).result).toEqual(await find(scheduleRequest()).result);
  });

  it('hashes the same request in another course order the same', async () => {
    const forward = await find(scheduleRequest()).result;
    const reversed = await find(
      scheduleRequest({ courseIds: [...scheduleRequest().courseIds].reverse() }),
    ).result;

    expect(reversed.pinnedInputs.constraintHash).toBe(forward.pinnedInputs.constraintHash);
  });

  it('never shows a TBA section as a PASS schedule', async () => {
    const tba = buildSection({ courseId: phys301.id, meetings: [buildTbaMeeting()] }, 3012);
    const sections = [SECTIONS.math102At9, SECTIONS.phys201At10, SECTIONS.engl101At11, tba];

    const response = await find(scheduleRequest(), { schedule: scheduleStore(sections) }).result;

    expect(response.outcome).toBe(ScheduleOutcome.OptionsFound);
    expect(response.options.map((option) => option.scheduleFeasibility.state)).toEqual([
      CheckState.Unknown,
    ]);
  });

  it('shows an included lab with its own prerequisite rule as UNKNOWN, never validated', async () => {
    const lab = buildSection(
      {
        courseId: phys301Lab.id,
        meetings: [buildMeetingPattern({ startTime: '15:00', endTime: '15:50' })],
      },
      3013,
    );
    const group = buildLinkedSectionGroup({
      primarySectionId: SECTIONS.phys301At14.id,
      components: [
        buildLinkedSectionComponent({ courseId: phys301Lab.id, permittedSectionIds: [lab.id] }),
      ],
    });
    const snapshot = buildSectionSnapshot(
      {
        sections: [...Object.values(SECTIONS), lab],
        linkedSectionGroups: [group],
        sourceEffectiveAt: buildScheduleSnapshot().sourceEffectiveAt,
      },
      1,
    );
    const labRule = buildPrerequisiteRule({
      courseId: phys301Lab.id,
      expression: course(math101.id),
      rulesetVersion: 'demo-2026.1',
    });

    const response = await find(scheduleRequest(), {
      schedule: { sectionSnapshots: [snapshot], transitionPolicies: [] },
      change: (store) => ({ ...store, rules: [...(store.rules ?? []), labRule] }),
    }).result;

    expect(ScheduleOptionsResponseSchema.safeParse(response).success).toBe(true);
    expect(response.options.length).toBeGreaterThan(0);
    for (const option of response.options) {
      expect(option.linkedCourseResults).toMatchObject([
        {
          courseId: phys301Lab.id,
          prerequisite: {
            state: CheckState.Unknown,
            reasonCode: ReasonCode.LinkedCourseNotChecked,
          },
          applicability: {
            state: CheckState.Unknown,
            reasonCode: ReasonCode.LinkedCourseNotChecked,
          },
        },
      ]);
      expect(option.aggregate).not.toBe(CheckState.Pass);
    }
  });

  it('needs verification, with no search, when a requested course has no section', async () => {
    const sections = [SECTIONS.math102At9, SECTIONS.phys201At10, SECTIONS.engl101At11];

    const response = await find(scheduleRequest(), { schedule: scheduleStore(sections) }).result;

    expect(response).toMatchObject({
      outcome: ScheduleOutcome.NeedsVerification,
      options: [],
      unresolved: [{ state: CheckState.Unknown, reasonCode: ReasonCode.SectionDataMissing }],
    });
  });

  it('reports SEARCH_TIMEOUT, never NO_FEASIBLE_PLAN or a 500, when the cap stops the search', async () => {
    const { result, logger } = find(scheduleRequest(), { workCap: 1 });

    expect(await result).toMatchObject({
      outcome: ScheduleOutcome.SearchTimeout,
      searchComplete: false,
      options: [],
      pinnedInputs: { solverWorkCap: 1 },
    });
    expect(logger.entries.at(-1)?.details).toMatchObject({ workUsed: 1, workCap: 1 });
  });

  it('logs the run with opaque IDs and solver counts only', async () => {
    const { result, logger } = find(scheduleRequest());

    await result;

    expect(logger.entries).toEqual([
      expect.objectContaining({ level: 'info', message: 'schedule options run' }),
    ]);
    expect(Object.keys(logger.entries[0]?.details ?? {}).sort()).toEqual([
      'actorUserId',
      'courseCount',
      'optionCount',
      'outcome',
      'sectionSnapshotId',
      'solverDurationMs',
      'studentId',
      'tenantId',
      'workCap',
      'workUsed',
    ]);
  });
});

describe('ScheduleOptionsService.findOptions dropped linked sections', () => {
  const unresolved = [
    { state: CheckState.Unknown, reasonCode: ReasonCode.LinkedSectionUnavailable },
  ];

  it('carries the dropped section in unresolved on OPTIONS_FOUND, with options unchanged', async () => {
    const base = await find(scheduleRequest()).result;
    const response = await find(scheduleRequest(), { schedule: droppedSectionStore() }).result;

    expect(ScheduleOptionsResponseSchema.safeParse(response).success).toBe(true);
    expect(response).toMatchObject({ outcome: ScheduleOutcome.OptionsFound, unresolved });
    expect(response.options).toEqual(base.options);
  });

  it('carries the same unresolved on SEARCH_TIMEOUT', async () => {
    const schedule = droppedSectionStore();
    const response = await find(scheduleRequest(), { schedule, workCap: 1 }).result;

    expect(ScheduleOptionsResponseSchema.safeParse(response).success).toBe(true);
    expect(response).toMatchObject({ outcome: ScheduleOutcome.SearchTimeout, unresolved });
  });
});

describe('ScheduleOptionsService.findOptions section sources', () => {
  it.each([
    ['exactly 24 hours old', '2026-09-01T12:00:00.000Z', true],
    ['one millisecond past 24 hours', '2026-09-01T12:00:00.001Z', false],
  ])('treats a snapshot %s as fresh: %s', async (_case, now, isFresh) => {
    const { result } = find(scheduleRequest(), {
      now,
      schedule: {
        sectionSnapshots: [
          buildScheduleSnapshot(undefined, { sourceEffectiveAt: '2026-08-31T12:00:00.000Z' }),
        ],
      },
    });

    if (isFresh) {
      await expect(result).resolves.toMatchObject({ outcome: ScheduleOutcome.OptionsFound });
    } else {
      await expect(result).rejects.toBeInstanceOf(StaleSourceError);
    }
  });

  it('refers a stale snapshot with STALE_SOURCE before the solver runs', async () => {
    const stale = buildScheduleSnapshot(undefined, { sourceEffectiveAt: '2026-08-01T00:00:00Z' });
    const { result, logger } = find(scheduleRequest(), { schedule: { sectionSnapshots: [stale] } });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
    expect(logger.entries.map((entry) => entry.message)).toEqual(['academic record unavailable']);
  });

  it('refers a term with no published snapshot with SOURCE_UNAVAILABLE', async () => {
    const { result, logger } = find(scheduleRequest(), { schedule: {} });

    await expect(result).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(logger.entries.map((entry) => entry.details.reason)).toEqual(['NO_SECTION_SNAPSHOT']);
  });

  it('refers a tie for the latest snapshot with STALE_SOURCE, never a pick', async () => {
    const tied = [
      buildScheduleSnapshot(),
      buildScheduleSnapshot([SECTIONS.math102At9], { seed: 2 }),
    ];

    const { result } = find(scheduleRequest(), { schedule: { sectionSnapshots: tied } });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
  });
});

describe('ScheduleOptionsService.findOptions request errors and access', () => {
  it('returns NOT_FOUND before reading sections when the actor may not see the student', async () => {
    const { result, logger } = find(scheduleRequest(), { isAllowed: false, schedule: {} });

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    expect(logger.entries).toEqual([]);
  });

  it('rejects a hard credit range outside the policy bounds as INVALID_REQUEST', async () => {
    const range = buildCreditRange({
      ...HARD_STRENGTH,
      minCreditsHundredths: 2000,
      maxCreditsHundredths: 2100,
    });
    const { result, logger } = find(scheduleRequest({ constraints: [range] }));

    await expect(result).rejects.toBeInstanceOf(InvalidRequestError);
    expect(logger.entries.map((entry) => entry.details.reason)).toEqual([
      'ScheduleInputError:creditRange',
    ]);
  });

  it('rejects a course outside the tenant catalog before the solver runs', async () => {
    const { result } = find(
      scheduleRequest({ courseIds: [math102.id, buildCourse({}, 0x999).id] }),
    );

    await expect(result).rejects.toBeInstanceOf(InvalidRequestError);
  });
});
