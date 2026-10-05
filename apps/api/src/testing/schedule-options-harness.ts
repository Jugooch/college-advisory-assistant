/**
 * @file Shared section data and requests for the schedule-options tests. The seeded catalog has
 * no published sections yet (#217), so these tests publish synthetic ones for four seeded
 * courses whose 14.00 credits fall within the seeded 12.00 to 18.00 term bounds. Test code only.
 * @module @caa/api/testing/schedule-options-harness
 */
import type { ScheduleOptionsRequest, ScheduleOptionsResponse } from '@caa/api-contract';
import { type MeetingPattern, type Section, type SectionSnapshot, TermIdSchema } from '@caa/domain';
import {
  buildMeetingPattern,
  buildSection,
  buildSectionSnapshot,
  SYNTHETIC_SCHEDULE_TERM,
} from '@caa/test-kit';

import { DEFAULT_SCHEDULE_SOLVER_WORK_CAP } from '../config/env';
import { createScheduleOptionsService } from '../modules/schedule-options/schedule-options.service';
import {
  CHECK_ACTOR,
  CHECK_NOW,
  CHECK_STUDENT,
  type CheckSetup,
  createSeededCourseSetInputs,
} from './course-checks-harness';
import { createRecordingLogger, type RecordingLogger } from './in-memory-repositories';
import type { InMemoryScheduleStore } from './in-memory-schedule-repositories';
import { buildSeedAcademicStore, SEED_COURSES } from './seed-scenario-fixtures';

const { math102, phys201, engl101, phys301 } = SEED_COURSES;

/**
 * When the published sections took effect: seven hours before the test clock
 * (2026-09-01T12:00Z), inside the 24-hour maximum age.
 */
export const SECTIONS_AT = '2026-09-01T05:00:00.000Z';

/**
 * A MWF meeting starting on the hour and lasting 50 minutes.
 *
 * @param hour - Start hour, 8 to 16.
 * @returns The meeting.
 */
function mwfAt(hour: number): MeetingPattern {
  const start = String(hour).padStart(2, '0');
  return buildMeetingPattern({ startTime: `${start}:00`, endTime: `${start}:50` });
}

/** One section per course at its own hour, and a second DEMO-MATH 102 section, so two options. */
export const SCHEDULE_SECTIONS = {
  math102At9: buildSection({ courseId: math102.id, meetings: [mwfAt(9)] }, 1021),
  math102At13: buildSection({ courseId: math102.id, meetings: [mwfAt(13)] }, 1022),
  phys201At10: buildSection({ courseId: phys201.id, meetings: [mwfAt(10)] }, 2011),
  engl101At11: buildSection({ courseId: engl101.id, meetings: [mwfAt(11)] }, 1011),
  phys301At14: buildSection({ courseId: phys301.id, meetings: [mwfAt(14)] }, 3011),
} as const;

/**
 * Builds the term's published snapshot.
 *
 * @param sections - The sections it lists; every schedule section by default.
 * @param overrides - Source time and seed.
 * @param overrides.sourceEffectiveAt - When the snapshot took effect.
 * @param overrides.seed - Drives the snapshot ID.
 * @returns The snapshot.
 */
export function buildScheduleSnapshot(
  sections: readonly Section[] = Object.values(SCHEDULE_SECTIONS),
  overrides: { readonly sourceEffectiveAt?: string; readonly seed?: number } = {},
): SectionSnapshot {
  return buildSectionSnapshot(
    { sections: [...sections], sourceEffectiveAt: overrides.sourceEffectiveAt ?? SECTIONS_AT },
    overrides.seed ?? 1,
  );
}

/**
 * The schedule fields of a store: one published snapshot and no transition table.
 *
 * @param sections - The sections the snapshot lists.
 * @returns The store fields to merge.
 */
export function scheduleStore(sections?: readonly Section[]): InMemoryScheduleStore {
  return { sectionSnapshots: [buildScheduleSnapshot(sections)], transitionPolicies: [] };
}

/** What a service-level schedule test varies. */
export interface ScheduleSetup extends CheckSetup {
  /** The schedule fields of the store; {@link scheduleStore}'s defaults when omitted. */
  readonly schedule?: InMemoryScheduleStore;
  /** The solver work cap; the documented default when omitted. */
  readonly workCap?: number;
}

/** A started schedule-options call, and what it logged. */
export interface ScheduleRun {
  readonly result: Promise<ScheduleOptionsResponse>;
  readonly logger: RecordingLogger;
}

/**
 * Creates the service over the seeded store plus published sections, and asks for options for
 * SYN-000001.
 *
 * @param request - The body.
 * @param setup - Store changes, schedule data, cap, ruleset, clock, and access decision.
 * @returns The call's promise and the recording logger.
 */
export function runScheduleOptions(
  request: ScheduleOptionsRequest,
  setup: ScheduleSetup = {},
): ScheduleRun {
  const seeded = { ...buildSeedAcademicStore(), ...(setup.schedule ?? scheduleStore()) };
  const store = { ...seeded, ...(setup.change ?? ((same) => same))(seeded) };
  const logger = createRecordingLogger();
  const service = createScheduleOptionsService({
    courseSetInputs: createSeededCourseSetInputs(store, setup),
    now: () => new Date(setup.now ?? CHECK_NOW),
    workCap: setup.workCap ?? DEFAULT_SCHEDULE_SOLVER_WORK_CAP,
  });
  const result = service.findOptions(
    CHECK_ACTOR,
    { studentId: CHECK_STUDENT.id, ...request },
    { logger },
  );
  return { result, logger };
}

/** The four seeded courses the schedule tests request, in request order. */
export const SCHEDULE_COURSE_IDS = [math102.id, phys201.id, engl101.id, phys301.id] as const;

/**
 * Builds a schedule-options body for the synthetic term.
 *
 * @param overrides - Fields to replace.
 * @returns The body.
 */
export function scheduleRequest(
  overrides: Partial<ScheduleOptionsRequest> = {},
): ScheduleOptionsRequest {
  return {
    termId: TermIdSchema.parse(SYNTHETIC_SCHEDULE_TERM.termId),
    courseIds: SCHEDULE_COURSE_IDS,
    creditSelections: [],
    constraints: [],
    ...overrides,
  };
}
