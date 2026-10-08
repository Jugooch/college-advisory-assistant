/**
 * @file Shared helpers for the case HTTP tests: a seeded world app with an empty case store, the
 * student saving a plan, and posting and reading case endpoints. Test code only.
 * @module @caa/api/testing/cases-harness
 */
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { z } from 'zod';

import { type CaseView, CaseViewSchema } from '@caa/api-contract';
import { CaseReason } from '@caa/domain';

import { buildSeededWorldApp } from './course-checks-harness';
import { bearer, STUDENTS, TOKENS } from './fixtures';
import type { InMemoryStore } from './in-memory-repositories';
import { postSave, readPlan, saveBodyFor, viewOptions } from './plan-drafts-harness';
import { scheduleStore } from './schedule-options-harness';
import { buildSeedAcademicStore } from './seed-scenario-fixtures';

/** The student's note in every test body; it must never appear in a log line. */
export const NOTE = 'My synthetic note about the plan, never to be logged.';

/** The seeded world app, its store, the captured log lines, and a function that resets the store. */
export interface CasesWorld {
  readonly app: FastifyInstance;
  readonly store: InMemoryStore;
  readonly lines: string[];
  readonly reset: () => void;
}

/**
 * Builds the seeded world app and a function that resets its store between tests.
 *
 * @returns The app, its store, the captured log lines, and the reset function.
 */
export function buildCasesWorld(): CasesWorld {
  const world = buildSeededWorldApp();
  const { students, assignments } = world.store;
  const reset = () => {
    world.lines.length = 0;
    Object.assign(world.store, buildSeedAcademicStore(), scheduleStore(), {
      students,
      assignments,
      plans: [],
      planRevisions: [],
      cases: [],
      caseEvents: [],
    });
  };
  return { ...world, reset };
}

/**
 * Saves the first option as the student, returning the saved revision's ID.
 *
 * @param app - The app under test.
 * @returns The ID of the new plan's latest revision.
 */
export async function savedRevisionId(app: FastifyInstance): Promise<string> {
  const body = saveBodyFor(await viewOptions(app));
  const response = await postSave(app, { studentId: STUDENTS.own.id, token: TOKENS.student, body });
  return readPlan(response).latest.id;
}

/**
 * Builds a valid plan-review body.
 *
 * @param planRevisionId - The revision to freeze.
 * @param overrides - Fields to add or replace.
 * @returns The body.
 */
export function reviewBody(
  planRevisionId: string | null,
  overrides: object = {},
): Record<string, unknown> {
  return {
    reason: CaseReason.PlanReview,
    planRevisionId,
    discrepancySubject: null,
    studentNote: NOTE,
    ...overrides,
  };
}

/** Who creates a case for which student, and what they send. */
export interface CreateCall {
  readonly studentId: string;
  readonly token: string | null;
  readonly body: unknown;
}

/**
 * Posts a create request.
 *
 * @param app - The app under test.
 * @param call - The path student, token (null for none), and body.
 * @returns The injected response.
 */
export function postCase(app: FastifyInstance, call: CreateCall): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/v1/students/${call.studentId}/cases`,
    headers: call.token === null ? {} : bearer(call.token),
    payload: call.body as object,
  });
}

/**
 * Gets a path with a token.
 *
 * @param app - The app under test.
 * @param url - The path.
 * @param token - Dev token.
 * @returns The injected response.
 */
export function getPath(
  app: FastifyInstance,
  url: string,
  token: string,
): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url, headers: bearer(token) });
}

/**
 * Parses a case view from a success response.
 *
 * @param response - The response.
 * @returns The case view.
 */
export function readCase(response: LightMyRequestResponse): CaseView {
  return z.object({ data: CaseViewSchema }).parse(response.json()).data;
}

/**
 * Creates a plan-review case as the student, after saving a plan.
 *
 * @param app - The app under test.
 * @returns The created case view.
 */
export async function createAsStudent(app: FastifyInstance): Promise<CaseView> {
  const response = await postCase(app, {
    studentId: STUDENTS.own.id,
    token: TOKENS.student,
    body: reviewBody(await savedRevisionId(app)),
  });
  return readCase(response);
}
