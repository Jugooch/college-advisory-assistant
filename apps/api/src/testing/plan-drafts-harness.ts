/**
 * @file Shared helpers for the plan draft HTTP tests: view options as the student would, build
 * the save body from them, and post and read plan endpoints. Test code only.
 * @module @caa/api/testing/plan-drafts-harness
 */
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { z } from 'zod';

import {
  type PlanRevisionView,
  PlanRevisionViewSchema,
  type PlanView,
  PlanViewSchema,
  type ScheduleOptionsRequest,
  type ScheduleOptionsResponse,
  ScheduleOptionsResponseSchema,
} from '@caa/api-contract';

import { bearer, STUDENTS, TOKENS } from './fixtures';
import { scheduleRequest } from './schedule-options-harness';

/** The body of a save request, before any test tampers with it. */
export interface SaveBody {
  readonly request: ScheduleOptionsRequest;
  readonly selectedSectionIds: readonly string[] | null;
  readonly expectedPinnedInputs: ScheduleOptionsResponse['pinnedInputs'];
}

/**
 * Lists the section IDs of one option.
 *
 * @param option - A replayed option.
 * @returns Its section IDs, in bundle order.
 */
export function sectionsOf(option: ScheduleOptionsResponse['options'][number]): string[] {
  return option.bundles.flatMap((bundle) => bundle.sections.map((section) => section.sectionId));
}

/**
 * Views schedule options as the student does, before saving.
 *
 * @param app - The app under test.
 * @param request - The schedule request; the default four-course request when omitted.
 * @returns The options the student was shown.
 */
export async function viewOptions(
  app: FastifyInstance,
  request: ScheduleOptionsRequest = scheduleRequest(),
): Promise<ScheduleOptionsResponse> {
  const response = await app.inject({
    method: 'POST',
    url: `/v1/students/${STUDENTS.own.id}/schedule-options`,
    headers: bearer(TOKENS.student),
    payload: request,
  });
  return ScheduleOptionsResponseSchema.parse(
    z.object({ data: z.unknown() }).parse(response.json()).data,
  );
}

/**
 * Builds the save body for the options the student was shown, choosing the first option.
 *
 * @param shown - The options the student viewed.
 * @param request - The request they were computed for.
 * @returns A valid save body.
 */
export function saveBodyFor(
  shown: ScheduleOptionsResponse,
  request: ScheduleOptionsRequest = scheduleRequest(),
): SaveBody {
  const [first] = shown.options;
  return {
    request,
    selectedSectionIds: first === undefined ? null : sectionsOf(first),
    expectedPinnedInputs: shown.pinnedInputs,
  };
}

/**
 * Posts a save request.
 *
 * @param app - The app under test.
 * @param call - The path student, the token (null for none), and the body.
 * @returns The injected response.
 */
export function postSave(
  app: FastifyInstance,
  call: { readonly studentId: string; readonly token: string | null; readonly body: object },
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/v1/students/${call.studentId}/plans`,
    headers: call.token === null ? {} : bearer(call.token),
    payload: call.body,
  });
}

/**
 * Gets a plan endpoint.
 *
 * @param app - The app under test.
 * @param path - The path after `/v1/students/:studentId`.
 * @param call - The path student (the signed-in student's own when omitted) and the token
 *   (the student's when omitted, null for none).
 * @param call.studentId - Path student.
 * @param call.token - Dev token, or null for none.
 * @returns The injected response.
 */
export function getPlans(
  app: FastifyInstance,
  path: string,
  call: { readonly studentId?: string; readonly token?: string | null } = {},
): Promise<LightMyRequestResponse> {
  const { studentId = STUDENTS.own.id, token = TOKENS.student } = call;
  return app.inject({
    method: 'GET',
    url: `/v1/students/${studentId}/plans${path}`,
    headers: token === null ? {} : bearer(token),
  });
}

/**
 * Reads a plan view from a success response.
 *
 * @param response - The injected response.
 * @returns The validated plan view.
 */
export function readPlan(response: LightMyRequestResponse): PlanView {
  return PlanViewSchema.parse(z.object({ data: z.unknown() }).parse(response.json()).data);
}

/**
 * Reads a revision view from a success response.
 *
 * @param response - The injected response.
 * @returns The validated revision view.
 */
export function readRevision(response: LightMyRequestResponse): PlanRevisionView {
  return PlanRevisionViewSchema.parse(z.object({ data: z.unknown() }).parse(response.json()).data);
}

/**
 * Lists the sections of the first option the student was shown.
 *
 * @param shown - The options the student viewed.
 * @returns The first option's section IDs.
 * @throws {Error} When the response has no option, which a test setup bug would cause.
 */
export function firstOptionSections(shown: ScheduleOptionsResponse): string[] {
  const [first] = shown.options;
  if (first === undefined) {
    throw new Error('The replay has no option');
  }
  return sectionsOf(first);
}

/**
 * Returns the first item of a seeded list.
 *
 * @param items - The list.
 * @returns The first item.
 * @throws {Error} When the list is empty, which a test setup bug would cause.
 */
export function firstOf<T>(items: readonly T[] | undefined): T {
  const [first] = items ?? [];
  if (first === undefined) {
    throw new Error('The seeded list is empty');
  }
  return first;
}
