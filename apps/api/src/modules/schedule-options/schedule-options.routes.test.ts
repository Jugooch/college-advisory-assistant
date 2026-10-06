/**
 * @file HTTP-level tests for `POST /v1/students/:studentId/schedule-options`: each role, 401,
 * NOT_FOUND that doesn't reveal existence, strict bodies, the section freshness gate, a missing
 * snapshot, a capped search as a 200 outcome, replay, and logs with opaque IDs only.
 * @requirement FR-01
 * @requirement FR-07
 * @requirement FR-10
 * @requirement NFR-01
 * @requirement NFR-04
 * @requirement NFR-07
 */
import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';

import { ScheduleOptionsResponseSchema } from '@caa/api-contract';
import { ErrorCode, ReasonCode, ScheduleOutcome } from '@caa/domain';
import {
  buildMeetingPattern,
  buildSection,
  buildStudent,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import { buildSeededWorldApp, readLogLines } from '../../testing/course-checks-harness';
import { bearer, readError, STUDENTS, TOKENS } from '../../testing/fixtures';
import {
  buildScheduleSnapshot,
  droppedSectionStore,
  SCHEDULE_SECTIONS,
  scheduleRequest,
  scheduleStore,
} from '../../testing/schedule-options-harness';
import { buildSeedAcademicStore, SEED_COURSES } from '../../testing/seed-scenario-fixtures';

// NOTE: every app is built once at module scope so Fastify's startup cost never counts against a
// test's timeout (#83).
const { app, store, lines } = buildSeededWorldApp();
const { app: cappedApp, store: cappedStore } = buildSeededWorldApp({}, { solverWorkCap: 1 });

beforeEach(() => {
  lines.length = 0;
  for (const target of [store, cappedStore]) {
    Object.assign(target, buildSeedAcademicStore(), scheduleStore());
  }
});

/**
 * Posts a schedule-options request.
 *
 * @param studentId - Path param, sent as-is.
 * @param token - Dev token, or null for no session.
 * @param options - The body (the default four-course request when omitted) and the app (the
 *   main one when omitted).
 * @param options.body - Request body.
 * @param options.target - App under test.
 * @returns The injected response.
 */
function postOptions(
  studentId: string,
  token: string | null,
  { body = scheduleRequest(), target = app }: { body?: object; target?: FastifyInstance } = {},
) {
  return target.inject({
    method: 'POST',
    url: `/v1/students/${studentId}/schedule-options`,
    headers: token === null ? {} : bearer(token),
    payload: body,
  });
}

/**
 * Reads a successful response's data with the contract schema.
 *
 * @param body - Parsed response body.
 * @returns The validated data.
 */
function readOptions(body: unknown) {
  return ScheduleOptionsResponseSchema.parse((body as { data: unknown }).data);
}

describe('POST /v1/students/:studentId/schedule-options', () => {
  it('returns two options to the student themself, pinned to the section snapshot', async () => {
    const response = await postOptions(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(200);
    const options = readOptions(response.json());
    expect(options.outcome).toBe(ScheduleOutcome.OptionsFound);
    expect(options.options).toHaveLength(2);
    expect(options.pinnedInputs.sectionSnapshotId).toBe(buildScheduleSnapshot().id);
  });

  it.each([
    ['an assigned advisor', TOKENS.advisor],
    ['an admin of the same tenant', TOKENS.tenantAdmin],
  ])('returns options to %s', async (_role, token) => {
    expect((await postOptions(STUDENTS.own.id, token)).statusCode).toBe(200);
  });

  it.each([
    ['an advisor for an unassigned student', STUDENTS.other.id, TOKENS.advisor],
    ['an admin of another tenant', STUDENTS.own.id, TOKENS.admin],
    ['a student who does not exist', buildStudent({}, 99).id, TOKENS.tenantAdmin],
    ['an ID that is not a UUID', 'not-a-uuid', TOKENS.tenantAdmin],
  ])('returns 404 NOT_FOUND to %s', async (_case, studentId, token) => {
    const response = await postOptions(studentId, token);

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
  });

  it('returns 401 without a session', async () => {
    expect((await postOptions(STUDENTS.own.id, null)).statusCode).toBe(401);
  });

  it.each([
    ['a tenant field', { ...scheduleRequest(), tenantId: SYNTHETIC_TENANTS.b.id }],
    ['a user field', { ...scheduleRequest(), userId: STUDENTS.other.id }],
    ['a role field', { ...scheduleRequest(), roles: ['ADMIN'] }],
    ['no courses', scheduleRequest({ courseIds: [] })],
  ])('returns 400 INVALID_REQUEST for a body with %s', async (_case, body) => {
    const response = await postOptions(STUDENTS.own.id, TOKENS.student, { body });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).code).toBe(ErrorCode.InvalidRequest);
  });

  it('sets the term and the campuses on a contract-valid 200', async () => {
    const response = await postOptions(STUDENTS.own.id, TOKENS.student);

    expect(readOptions(response.json())).toMatchObject({
      term: { id: scheduleRequest().termId },
      campuses: [{ id: SYNTHETIC_CAMPUSES.north.id, name: SYNTHETIC_CAMPUSES.north.name }],
    });
  });

  it('gives deep-equal bodies when the same request is replayed', async () => {
    const first = await postOptions(STUDENTS.own.id, TOKENS.student);
    const second = await postOptions(STUDENTS.own.id, TOKENS.student);

    expect(second.json()).toEqual(first.json());
  });
});

describe('POST /v1/students/:studentId/schedule-options sources and the cap', () => {
  it('returns 409 STALE_SOURCE with a referral for a stale section snapshot', async () => {
    store.sectionSnapshots = [
      buildScheduleSnapshot(undefined, { sourceEffectiveAt: '2026-08-01T00:00:00.000Z' }),
    ];

    const response = await postOptions(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(409);
    expect(readError(response.json())).toEqual({
      code: ErrorCode.StaleSource,
      message: 'Your academic record needs to be verified. Please contact your advisor.',
    });
  });

  it.each([
    ['has no row', []],
    [
      'has a row only in another tenant',
      [{ ...SYNTHETIC_CAMPUSES.north, tenantId: SYNTHETIC_TENANTS.b.id }],
    ],
  ])(
    'returns 503 SOURCE_UNAVAILABLE, logging the campus ID, when a named campus %s',
    async (_case, campuses) => {
      store.campuses = campuses;

      const response = await postOptions(STUDENTS.own.id, TOKENS.student);

      expect(response.statusCode).toBe(503);
      expect(readError(response.json()).code).toBe(ErrorCode.SourceUnavailable);
      const entry = readLogLines(lines).find((line) => line.msg === 'campus missing');
      expect(entry?.campusIds).toEqual([SYNTHETIC_CAMPUSES.north.id]);
    },
  );

  it('lists two campuses ordered by id, and none when no section is returned', async () => {
    const onSouth = buildSection(
      {
        courseId: SEED_COURSES.engl101.id,
        campusId: SYNTHETIC_CAMPUSES.south.id,
        meetings: [buildMeetingPattern({ startTime: '11:00', endTime: '11:50' })],
      },
      1011,
    );
    const others = Object.values(SCHEDULE_SECTIONS).filter(
      (section) => section.id !== SCHEDULE_SECTIONS.engl101At11.id,
    );
    store.sectionSnapshots = [buildScheduleSnapshot([...others, onSouth])];
    const both = await postOptions(STUDENTS.own.id, TOKENS.student);
    store.sectionSnapshots = [buildScheduleSnapshot([SCHEDULE_SECTIONS.math102At9])];
    const none = await postOptions(STUDENTS.own.id, TOKENS.student);

    const expectedIds = [SYNTHETIC_CAMPUSES.north.id, SYNTHETIC_CAMPUSES.south.id].sort();
    expect(readOptions(both.json())).toMatchObject({
      campuses: expectedIds.map((id) => ({ id })),
    });
    expect(readOptions(none.json()).term).toBeDefined();
    expect(readOptions(none.json())).toMatchObject({ campuses: [] });
  });

  it('returns 503 SOURCE_UNAVAILABLE when the term has no published snapshot', async () => {
    store.sectionSnapshots = [];

    const response = await postOptions(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(503);
    expect(readError(response.json()).code).toBe(ErrorCode.SourceUnavailable);
  });

  it('answers a capped search with a 200 SEARCH_TIMEOUT, never a 500 or NO_FEASIBLE_PLAN', async () => {
    const response = await postOptions(STUDENTS.own.id, TOKENS.student, {
      target: cappedApp,
    });

    expect(response.statusCode).toBe(200);
    expect(readOptions(response.json())).toMatchObject({
      outcome: ScheduleOutcome.SearchTimeout,
      searchComplete: false,
      pinnedInputs: { solverWorkCap: 1 },
    });
  });

  it('returns 200 with the dropped section in unresolved on OPTIONS_FOUND and SEARCH_TIMEOUT', async () => {
    Object.assign(store, droppedSectionStore());
    Object.assign(cappedStore, droppedSectionStore());

    const found = await postOptions(STUDENTS.own.id, TOKENS.student);
    const capped = await postOptions(STUDENTS.own.id, TOKENS.student, { target: cappedApp });

    expect(found.statusCode).toBe(200);
    expect(capped.statusCode).toBe(200);
    expect(readOptions(found.json())).toMatchObject({
      outcome: ScheduleOutcome.OptionsFound,
      unresolved: [{ reasonCode: ReasonCode.LinkedSectionUnavailable }],
    });
    expect(readOptions(capped.json())).toMatchObject({
      outcome: ScheduleOutcome.SearchTimeout,
      unresolved: [{ reasonCode: ReasonCode.LinkedSectionUnavailable }],
    });
  });

  it('logs the run with the request ID and opaque IDs only', async () => {
    const response = await postOptions(STUDENTS.own.id, TOKENS.student);
    const parsed = readLogLines(lines);
    const completed = parsed.find((line) => line.msg === 'request completed');

    expect(response.statusCode).toBe(200);
    expect(parsed.filter((line) => line.msg === 'schedule options run')).toEqual([
      expect.objectContaining({ reqId: completed?.reqId, workCap: 3_000_000 }),
    ]);
    expect(lines.join('')).not.toContain(STUDENTS.own.sourceStudentId);
    expect(lines.join('')).not.toContain('DEMO-');
  });
});
