/**
 * @file Shared world, requests, and source-supersession helpers for the plan draft acceptance
 * cases (AC14, AC16, AC32, AC33; AC34 is pending #410): `POST /v1/students/:studentId/plans`
 * and the plan reads. The
 * default world is the schedule one with two compatible published sections, so exactly one option
 * is offered and every case states only what it varies.
 * @module @caa/tests/support/plan-drafts-harness
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { expect } from 'vitest';

import { Weekday } from '@caa/domain';
import {
  buildAuditSnapshot,
  buildCampusTransitionPolicy,
  buildMeetingPattern,
  buildSection,
  buildSectionSnapshot,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import {
  ACADEMIC_STUDENT_ID,
  type AcademicRequestAs,
  RECORD_AT,
  recordSnapshot,
} from './academic-endpoints-harness';
import {
  type AcceptanceApp,
  type AcceptanceResponse,
  type AcceptanceWorld,
  getAs,
  postAs,
} from './api-harness';
import {
  findScheduleOptions,
  publishSections,
  publishTransitions,
  resetScheduleWorld,
  scheduleRequest,
} from './schedule-options-harness';

const { math102, phys201 } = SYNTHETIC_COURSES;

/** DEMO-MATH 102, MWF 09:00-09:50. */
export const MATH_MWF = buildSection({ courseId: math102.id }, 61);

/** DEMO-PHYS 201, TTh 09:00-09:50, compatible with {@link MATH_MWF}. */
export const PHYS_TTH = buildSection(
  {
    courseId: phys201.id,
    meetings: [buildMeetingPattern({ weekdays: [Weekday.Tuesday, Weekday.Thursday] })],
  },
  62,
);

/** The request the cases view and save: both courses, no credit selections or constraints. */
export const BOTH_COURSES = scheduleRequest([math102.id, phys201.id]);

/** A source time later than every default one and earlier than the harness clock. */
export const NEWER_SOURCE_AT = '2026-09-01T08:00:00.000Z';

/**
 * Resets the world to the default plan draft one: the schedule defaults, {@link MATH_MWF} and
 * {@link PHYS_TTH} published, an empty campus transition table (version `demo-2026.1`), and no
 * plans.
 *
 * @param world - The world to reset.
 */
export function resetPlanWorld(world: AcceptanceWorld): void {
  resetScheduleWorld(world);
  publishSections(world, [MATH_MWF, PHYS_TTH]);
  // NOTE: the table exists at save time so a later table is a change, not a first table.
  publishTransitions(world, []);
  world.plans = [];
  world.planRevisions = [];
}

/**
 * Asserts that a save succeeded with a 2xx status. The contract specifies 201
 * (`plan-drafts.contract.ts`), but the api returns 200 until #443 lands, so the exact 201 check
 * lives in AC32's dedicated known-finding tests and this one lets the replay and safety checks
 * run meanwhile.
 *
 * @param response - The save response.
 */
export function expectSaved(response: AcceptanceResponse): void {
  expect(response.statusCode).toBeGreaterThanOrEqual(200);
  expect(response.statusCode).toBeLessThan(300);
}

/**
 * Reads the response's `data` object.
 *
 * @param response - The response.
 * @returns The data object, or an empty object when there is none.
 */
export function dataOf(response: AcceptanceResponse): Record<string, unknown> {
  const body = response.body as { data?: Record<string, unknown> } | null;
  return body?.data ?? {};
}

/** The section IDs of the default option, sorted. */
export const DEFAULT_OPTION_SECTIONS = [MATH_MWF.id, PHYS_TTH.id].sort();

/**
 * Builds a save body from what the student was shown.
 *
 * @param shown - The schedule-options response the student viewed.
 * @param selectedSectionIds - The chosen section set, or null.
 * @param request - The schedule-options request the student sent.
 * @returns The JSON body.
 */
export function saveBody(
  shown: AcceptanceResponse,
  selectedSectionIds: readonly string[] | null,
  request: object = BOTH_COURSES,
): Record<string, unknown> {
  return { request, selectedSectionIds, expectedPinnedInputs: dataOf(shown).pinnedInputs };
}

/**
 * Views the schedule options for {@link BOTH_COURSES} as the student.
 *
 * @param app - App under test.
 * @returns The response the student saw.
 */
export function viewDefaultOptions(app: AcceptanceApp): Promise<AcceptanceResponse> {
  return findScheduleOptions(app, BOTH_COURSES);
}

/**
 * Saves a plan draft.
 *
 * @param app - App under test.
 * @param payload - The JSON body.
 * @param as - Actor and student; the student saving their own plan by default.
 * @returns The response.
 */
export function savePlan(
  app: AcceptanceApp,
  payload: object,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID }: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  return postAs(app, {
    url: `/v1/students/${studentId}/plans`,
    authorization: `Bearer academic-${actor}`,
    payload,
  });
}

/**
 * Views the default options and saves the one offered, as the student.
 *
 * @param app - App under test.
 * @returns The save response.
 */
export async function saveDefaultOption(app: AcceptanceApp): Promise<AcceptanceResponse> {
  const shown = await viewDefaultOptions(app);
  return savePlan(app, saveBody(shown, DEFAULT_OPTION_SECTIONS));
}

/**
 * Reads a plan, or one of its revisions.
 *
 * @param app - App under test.
 * @param path - Path after `/plans`, for example `/<planId>` or `/<planId>/revisions/1`.
 * @param as - Actor and student; the student reading their own plan by default.
 * @returns The response.
 */
export function readPlanAt(
  app: AcceptanceApp,
  path: string,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID }: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  return getAs(app, `/v1/students/${studentId}/plans${path}`, `Bearer academic-${actor}`);
}

/**
 * Reads the plan list.
 *
 * @param app - App under test.
 * @param as - Actor and student; the student reading their own plans by default.
 * @returns The response.
 */
export function listPlans(
  app: AcceptanceApp,
  as: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  return readPlanAt(app, '', as);
}

/**
 * Reads the freshness the plan shows for its latest revision.
 *
 * @param response - A plan response.
 * @returns The `freshness` object of `data.latest`, or undefined.
 */
export function latestFreshness(response: AcceptanceResponse): unknown {
  const latest = dataOf(response).latest as { freshness?: unknown } | undefined;
  return latest?.freshness;
}

/**
 * Stores a newer student record than the pinned one (seed 2, source time {@link NEWER_SOURCE_AT}).
 *
 * @param world - The world.
 */
export function supersedeStudentRecord(world: AcceptanceWorld): void {
  world.studentSnapshots = [
    ...(world.studentSnapshots ?? []),
    recordSnapshot({ sourceEffectiveAt: NEWER_SOURCE_AT, ingestedAt: NEWER_SOURCE_AT }, 2),
  ];
}

/**
 * Stores a newer audit than the pinned one (seed 2, generated at {@link NEWER_SOURCE_AT}).
 *
 * @param world - The world.
 */
export function supersedeAudit(world: AcceptanceWorld): void {
  world.audits = [
    ...(world.audits ?? []),
    buildAuditSnapshot({ generatedAt: NEWER_SOURCE_AT, studentRecordEffectiveAt: RECORD_AT }, 2),
  ];
}

/**
 * Stores a newer section snapshot of the same sections (seed 2, at {@link NEWER_SOURCE_AT}).
 *
 * @param world - The world.
 */
export function supersedeSections(world: AcceptanceWorld): void {
  world.sectionSnapshots = [
    ...(world.sectionSnapshots ?? []),
    buildSectionSnapshot({ sections: [MATH_MWF, PHYS_TTH], sourceEffectiveAt: NEWER_SOURCE_AT }, 2),
  ];
}

/**
 * Stores a newer campus transition table (version `demo-2026.2`).
 *
 * @param world - The world.
 */
export function supersedeTransitionTable(world: AcceptanceWorld): void {
  world.campusTransitionPolicies = [
    ...(world.campusTransitionPolicies ?? []),
    buildCampusTransitionPolicy({ version: 'demo-2026.2' }),
  ];
}

/**
 * Lists every object key and every string value in a JSON value, at any depth.
 *
 * @param value - The parsed JSON.
 * @returns The keys and the string values, in document order.
 */
export function keysAndStrings(value: unknown): { keys: string[]; strings: string[] } {
  const found: { keys: string[]; strings: string[] } = { keys: [], strings: [] };
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      found.strings.push(node);
    } else if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (typeof node === 'object' && node !== null) {
      for (const [key, child] of Object.entries(node)) {
        found.keys.push(key);
        walk(child);
      }
    }
  };
  walk(value);
  return found;
}

/**
 * Copies a plan revision response without its `freshness`, which is the one part that changes with
 * later sources and the clock.
 *
 * @param response - A plan-revision response.
 * @returns The stored part of the revision.
 */
export function storedPartOf(response: AcceptanceResponse): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(dataOf(response)).filter(([key]) => key !== 'freshness'),
  );
}
