/**
 * @file Shared world and requests for the advisor case acceptance cases (AC35, AC36, AC37):
 * `POST /v1/students/:studentId/cases`, the student's list and `GET /v1/cases/:caseId`. The world
 * is the plan draft one (a saved plan whose revision a case can pin), plus the case rows.
 * @module @caa/tests/support/cases-harness
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { expect } from 'vitest';

import {
  ACADEMIC_STUDENT_ID,
  type AcademicActor,
  type AcademicRequestAs,
} from './academic-endpoints-harness';
import {
  type AcceptanceApp,
  type AcceptanceResponse,
  type AcceptanceWorld,
  getAs,
  postAs,
} from './api-harness';
import type { CaseWorld } from './case-repositories';
import { dataOf, resetPlanWorld, saveDefaultOption } from './plan-drafts-harness';

/** The acceptance world plus the case rows the case repository fake stores. */
export type CasesWorld = AcceptanceWorld & CaseWorld;

/** A student note the cases use. */
export const STUDENT_NOTE = 'Please check my plan before I register.';

/** Effective-to timestamp that ends the default assignment before the harness clock. */
export const REVOKED_AT = '2026-08-30T00:00:00.000-05:00';

/**
 * Serializes everything in the world except the case rows, to compare before and after actions.
 *
 * @param world - The world.
 * @returns The world as JSON text without `cases` and `caseEvents`.
 */
export function nonCaseData(world: CasesWorld): string {
  return JSON.stringify(world, (key, value: unknown) =>
    key === 'cases' || key === 'caseEvents' ? undefined : value,
  );
}

/**
 * Resets the world to the plan draft one with no cases.
 *
 * @param world - The world to reset.
 */
export function resetCasesWorld(world: CasesWorld): void {
  resetPlanWorld(world);
  world.cases = [];
  world.caseEvents = [];
}

/**
 * Saves the default option as the student and returns the revision a case can pin.
 *
 * @param app - App under test.
 * @returns The plan ID and the ID of its latest revision.
 */
export async function saveRevision(
  app: AcceptanceApp,
): Promise<{ planId: string; revisionId: string }> {
  const data = dataOf(await saveDefaultOption(app));
  const latest = data.latest as { id: string };
  return { planId: String(data.id), revisionId: latest.id };
}

/**
 * Builds a plan review request body.
 *
 * @param planRevisionId - The revision to review.
 * @param studentNote - The note, 1 to 500 characters.
 * @returns The JSON body.
 */
export function planReviewBody(
  planRevisionId: string,
  studentNote: string = STUDENT_NOTE,
): Record<string, unknown> {
  return { reason: 'PLAN_REVIEW', planRevisionId, discrepancySubject: null, studentNote };
}

/**
 * Builds a source discrepancy request body, which names no plan revision.
 *
 * @param discrepancySubject - What the student says is wrong.
 * @param studentNote - The note, 1 to 500 characters.
 * @returns The JSON body.
 */
export function discrepancyBody(
  discrepancySubject: string,
  studentNote = 'My transcript shows a grade I do not recognize.',
): Record<string, unknown> {
  return {
    reason: 'SOURCE_DISCREPANCY',
    planRevisionId: null,
    discrepancySubject,
    studentNote,
  };
}

/**
 * Creates a case.
 *
 * @param app - App under test.
 * @param payload - The JSON body.
 * @param as - Actor and student; the student for their own record by default.
 * @returns The response.
 */
export function createCase(
  app: AcceptanceApp,
  payload: object,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID }: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  return postAs(app, {
    url: `/v1/students/${studentId}/cases`,
    authorization: `Bearer academic-${actor}`,
    payload,
  });
}

/**
 * Reads one case.
 *
 * @param app - App under test.
 * @param caseId - The case.
 * @param actor - Who reads; the student by default.
 * @returns The response.
 */
export function readCase(
  app: AcceptanceApp,
  caseId: string,
  actor: AcademicActor = 'student',
): Promise<AcceptanceResponse> {
  return getAs(app, `/v1/cases/${caseId}`, `Bearer academic-${actor}`);
}

/**
 * Lists a student's cases.
 *
 * @param app - App under test.
 * @param as - Actor and student; the student reading their own list by default.
 * @returns The response.
 */
export function listCases(
  app: AcceptanceApp,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID }: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  return getAs(app, `/v1/students/${studentId}/cases`, `Bearer academic-${actor}`);
}

/** Never-stored revision ID (a valid UUID). */
export const UNKNOWN_REVISION_ID = '70000000-0000-4000-8000-0000000003e7';

/** The 404 a missing resource gives, so a refused actor learns nothing. */
export const NOT_FOUND = { statusCode: 404, bodyKeys: ['error'], code: 'NOT_FOUND' };

/** The 400 a malformed body gives. */
export const INVALID = { statusCode: 400, bodyKeys: ['error'], code: 'INVALID_REQUEST' };

/**
 * Asserts that no case and no case event was stored.
 *
 * @param world - The world.
 */
export function expectNoCaseWritten(world: CasesWorld): void {
  expect(world.cases).toEqual([]);
  expect(world.caseEvents).toEqual([]);
}

/**
 * Saves a revision and opens a plan review case on it as the student.
 *
 * @param app - App under test.
 * @returns The IDs and the create response.
 */
export async function openCase(app: AcceptanceApp): Promise<{
  planId: string;
  revisionId: string;
  created: AcceptanceResponse;
  caseId: string;
}> {
  const { planId, revisionId } = await saveRevision(app);
  const created = await createCase(app, planReviewBody(revisionId));
  return { planId, revisionId, created, caseId: String(dataOf(created).id) };
}

/**
 * Copies a plan revision view without its `freshness`, the part that changes with later sources.
 *
 * @param view - A revision view, such as a case's `context`.
 * @returns The stored part.
 */
export function withoutFreshness(view: unknown): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(view as Record<string, unknown>).filter(([key]) => key !== 'freshness'),
  );
}

/** A case action body: the action, the sequence the caller saw, and a resolution on RESOLVE. */
export interface CaseActionBody {
  readonly action: 'CLAIM' | 'RELEASE' | 'RESOLVE' | 'WITHDRAW';
  readonly expectedSequence: number;
  readonly resolution?: 'PLAN_REVIEWED' | 'STUDENT_ACTION_NEEDED' | 'REFERRED_OUTSIDE_APP';
  readonly note?: string;
}

/**
 * Takes an action on a case through `POST /v1/cases/:caseId/events` as the assigned advisor.
 *
 * @param app - App under test.
 * @param caseId - The case.
 * @param payload - The JSON body; any object, so a test can send a forbidden field.
 * @returns The response.
 */
export function actOnCase(
  app: AcceptanceApp,
  caseId: string,
  payload: CaseActionBody | Record<string, unknown>,
): Promise<AcceptanceResponse> {
  return actAs(app, 'advisor')(caseId, payload);
}

/**
 * Builds the case action request for one actor.
 *
 * @param app - App under test.
 * @param actor - Who acts.
 * @returns A function that takes an action on a case and returns the response.
 */
export function actAs(
  app: AcceptanceApp,
  actor: AcademicActor,
): (
  caseId: string,
  payload: CaseActionBody | Record<string, unknown>,
) => Promise<AcceptanceResponse> {
  return (caseId, payload) =>
    postAs(app, {
      url: `/v1/cases/${caseId}/events`,
      authorization: `Bearer academic-${actor}`,
      payload,
    });
}

/**
 * Reads the advisor queue.
 *
 * @param app - App under test.
 * @param query - Query string including the `?`, or empty.
 * @param actor - Who reads; the assigned advisor by default.
 * @returns The response.
 */
export function readQueue(
  app: AcceptanceApp,
  query = '',
  actor: AcademicActor = 'advisor',
): Promise<AcceptanceResponse> {
  return getAs(app, `/v1/advisor/cases${query}`, `Bearer academic-${actor}`);
}

/**
 * Opens a case as the student and claims it as the assigned advisor.
 *
 * @param app - App under test.
 * @returns The ids of the open case and the claim response.
 */
export async function claimedCase(app: AcceptanceApp): Promise<{
  planId: string;
  revisionId: string;
  caseId: string;
  claimed: AcceptanceResponse;
}> {
  const opened = await openCase(app);
  const claimed = await actOnCase(app, opened.caseId, { action: 'CLAIM', expectedSequence: 1 });
  return { planId: opened.planId, revisionId: opened.revisionId, caseId: opened.caseId, claimed };
}
