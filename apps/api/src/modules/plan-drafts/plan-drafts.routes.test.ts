/**
 * @file HTTP-level tests for `POST /v1/students/:studentId/plans`: save by replay, append,
 * every refusal (401, 404, 400, 409, 503), nothing written on a refusal, and safe logs.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-11
 * @requirement FR-14
 * @requirement NFR-01
 * @requirement NFR-04
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { ErrorCode, PlanFreshness, PlanRevisionCause, ScheduleOutcome } from '@caa/domain';
import { buildAuditSnapshot, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { buildSeededWorldApp, readLogLines } from '../../testing/course-checks-harness';
import { readError, STUDENTS, TOKENS } from '../../testing/fixtures';
import {
  firstOf,
  firstOptionSections,
  postSave,
  readPlan,
  saveBodyFor,
  viewOptions,
} from '../../testing/plan-drafts-harness';
import { buildScheduleSnapshot, scheduleStore } from '../../testing/schedule-options-harness';
import { buildSeedAcademicStore } from '../../testing/seed-scenario-fixtures';

// NOTE: apps are built once at module scope so Fastify's startup cost never counts against a
// test's timeout (#83).
const { app, store, lines } = buildSeededWorldApp();
const { app: cappedApp, store: cappedStore } = buildSeededWorldApp({}, { solverWorkCap: 1 });

beforeEach(() => {
  lines.length = 0;
  for (const target of [store, cappedStore]) {
    Object.assign(target, buildSeedAcademicStore(), scheduleStore(), {
      plans: [],
      planRevisions: [],
    });
  }
});

/**
 * Saves the first option the student is shown, as the student.
 *
 * @param overrides - Fields to replace in the body.
 * @returns The injected response.
 */
async function saveAsStudent(overrides: object = {}) {
  const body = saveBodyFor(await viewOptions(app));
  return postSave(app, {
    studentId: STUDENTS.own.id,
    token: TOKENS.student,
    body: { ...body, ...overrides },
  });
}

describe('POST /v1/students/:studentId/plans', () => {
  it('saves revision 1 as the replay, deep-equal to the options the student was shown', async () => {
    const shown = await viewOptions(app);

    const response = await saveAsStudent();

    expect(response.statusCode).toBe(201);
    const plan = readPlan(response);
    expect(plan.latest.revision).toBe(1);
    expect(plan.latest.cause).toBe(PlanRevisionCause.Saved);
    expect(plan.latest.result).toEqual(shown);
    expect(plan.latest.freshness.state).toBe(PlanFreshness.Current);
    expect(plan.revisions).toHaveLength(1);
  });

  it('stores the chosen sections sorted, whatever order the client sent', async () => {
    const reversed = firstOptionSections(await viewOptions(app)).reverse();

    const plan = readPlan(await saveAsStudent({ selectedSectionIds: reversed }));

    expect(plan.latest.selectedSectionIds).toEqual([...reversed].sort());
  });

  it('appends revision 2 to the same plan on a second save, keeping revision 1', async () => {
    const first = readPlan(await saveAsStudent());

    const second = readPlan(await saveAsStudent());

    expect(second.id).toBe(first.id);
    expect(second.latest.revision).toBe(2);
    expect(second.revisions.map((entry) => entry.revision)).toEqual([1, 2]);
    expect(store.plans).toHaveLength(1);
    expect(store.planRevisions).toHaveLength(2);
  });

  it('saves an outcome with no options with a null selection (never a section)', async () => {
    const shown = await viewOptions(cappedApp);
    expect(shown.outcome).toBe(ScheduleOutcome.SearchTimeout);

    const response = await postSave(cappedApp, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: saveBodyFor(shown),
    });

    expect(readPlan(response).latest).toMatchObject({
      outcome: ScheduleOutcome.SearchTimeout,
      selectedSectionIds: null,
    });
  });

  it('refuses a selection for an outcome with no options, writing nothing', async () => {
    const shown = await viewOptions(cappedApp);

    const response = await postSave(cappedApp, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: {
        ...saveBodyFor(shown),
        selectedSectionIds: [store.sectionSnapshots?.[0]?.sections[0]?.id],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(cappedStore.planRevisions).toEqual([]);
  });

  it('never says registered, enrolled, or approved', async () => {
    const response = await saveAsStudent();

    // NOTE: the limitation codes that deny registration are the only mentions allowed.
    const text = response.body.replace(/NOT_REGISTERED|REGISTRATION_READINESS_NOT_CHECKED/g, '');
    expect(text).not.toMatch(/regist|enroll|approv/i);
  });

  it('logs the save with opaque IDs only, never courses, constraints, or source IDs', async () => {
    await saveAsStudent();

    const saved = readLogLines(lines).filter((line) => line.msg === 'plan draft saved');
    expect(saved).toHaveLength(1);
    expect(lines.join('')).not.toContain(STUDENTS.own.sourceStudentId);
    expect(lines.join('')).not.toContain('DEMO-');
  });
});

describe('POST /v1/students/:studentId/plans refusals write nothing', () => {
  it.each([
    ['an assigned advisor', STUDENTS.own.id, TOKENS.advisor],
    ['an admin of the same tenant', STUDENTS.own.id, TOKENS.tenantAdmin],
    ['an admin of another tenant', STUDENTS.own.id, TOKENS.admin],
    ['the student for another student', STUDENTS.other.id, TOKENS.student],
    ['the student for an ID that is not a UUID', 'not-a-uuid', TOKENS.student],
  ])('returns 404 NOT_FOUND to %s', async (_case, studentId, token) => {
    const body = saveBodyFor(await viewOptions(app));

    const response = await postSave(app, { studentId, token, body });

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
    expect(store.planRevisions).toEqual([]);
  });

  it('returns 401 without a session', async () => {
    const body = saveBodyFor(await viewOptions(app));

    expect(
      (await postSave(app, { studentId: STUDENTS.own.id, token: null, body })).statusCode,
    ).toBe(401);
  });

  it.each([
    ['a tenant field', { tenantId: SYNTHETIC_TENANTS.b.id }],
    ['a user field', { userId: STUDENTS.other.id }],
    ['a role field', { roles: ['ADMIN'] }],
    ['an owner field', { ownerUserId: STUDENTS.other.id }],
    ['a client result', { result: { outcome: 'OPTIONS_FOUND' } }],
    ['no expected pinned inputs', { expectedPinnedInputs: undefined }],
    ['an empty selection', { selectedSectionIds: [] }],
    ['a repeated section', { selectedSectionIds: ['a', 'a'] }],
  ])('returns 400 INVALID_REQUEST for a body with %s', async (_case, extra) => {
    const response = await saveAsStudent(extra);

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).code).toBe(ErrorCode.InvalidRequest);
    expect(store.planRevisions).toEqual([]);
  });

  it('returns 400 when the chosen sections are not one of the replayed options', async () => {
    const subset = firstOptionSections(await viewOptions(app)).slice(1);

    const response = await saveAsStudent({ selectedSectionIds: subset });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).code).toBe(ErrorCode.InvalidRequest);
    expect(store.planRevisions).toEqual([]);
  });

  it('returns 400 for no selection when the replay has options', async () => {
    const response = await saveAsStudent({ selectedSectionIds: null });

    expect(response.statusCode).toBe(400);
    expect(store.planRevisions).toEqual([]);
  });

  it('returns 409 REVISION_CONFLICT when a source changed between viewing and saving', async () => {
    const body = saveBodyFor(await viewOptions(app));
    store.sectionSnapshots = [
      buildScheduleSnapshot(undefined, { sourceEffectiveAt: '2026-09-01T06:00:00.000Z', seed: 2 }),
    ];

    const response = await postSave(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body,
    });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).code).toBe(ErrorCode.RevisionConflict);
    expect(store.plans).toEqual([]);
    expect(store.planRevisions).toEqual([]);
  });

  it('returns 409 REVISION_CONFLICT when the client states different pinned inputs', async () => {
    const shown = await viewOptions(app);
    const tampered = { ...shown.pinnedInputs, rulesetVersion: 'demo-2026.0' };

    const response = await saveAsStudent({ expectedPinnedInputs: tampered });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).code).toBe(ErrorCode.RevisionConflict);
    expect(store.planRevisions).toEqual([]);
  });

  it('returns 409 STALE_SOURCE from the replay when the sections are too old, writing nothing', async () => {
    const body = saveBodyFor(await viewOptions(app));
    store.sectionSnapshots = [
      buildScheduleSnapshot(undefined, { sourceEffectiveAt: '2026-08-01T00:00:00.000Z' }),
    ];

    const response = await postSave(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body,
    });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).code).toBe(ErrorCode.StaleSource);
    expect(store.planRevisions).toEqual([]);
  });

  it('returns 503 SOURCE_UNAVAILABLE from the replay when no sections are published', async () => {
    const body = saveBodyFor(await viewOptions(app));
    store.sectionSnapshots = [];

    const response = await postSave(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body,
    });

    expect(response.statusCode).toBe(503);
    expect(readError(response.json()).code).toBe(ErrorCode.SourceUnavailable);
    expect(store.planRevisions).toEqual([]);
  });

  it('returns 409 STALE_SOURCE from the replay when the audit is tied for latest', async () => {
    const body = saveBodyFor(await viewOptions(app));
    const audit = firstOf(store.audits);
    store.audits = [...(store.audits ?? []), { ...audit, id: buildAuditSnapshot({}, 99).id }];

    const response = await postSave(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body,
    });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).code).toBe(ErrorCode.StaleSource);
    expect(store.planRevisions).toEqual([]);
  });
});
