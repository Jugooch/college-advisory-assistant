/**
 * @file HTTP-level tests for `POST /v1/students/:studentId/plans/:planId/revalidate`: the new
 * revision, selection carry-over, every refusal (401, 404, 400, 409, 503), nothing written on a
 * refusal, revision 1 left unchanged, and safe logs.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { ErrorCode, PlanFreshness, PlanRevisionCause } from '@caa/domain';
import { buildAuditSnapshot, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { buildSeededWorldApp, readLogLines } from '../../testing/course-checks-harness';
import { readError, STUDENTS, TOKENS } from '../../testing/fixtures';
import {
  firstOf,
  getPlans,
  postRevalidate,
  postSave,
  readPlan,
  readRevision,
  saveBodyFor,
  viewOptions,
} from '../../testing/plan-drafts-harness';
import { buildScheduleSnapshot, scheduleStore } from '../../testing/schedule-options-harness';
import { buildSeedAcademicStore } from '../../testing/seed-scenario-fixtures';

// NOTE: the app is built once at module scope so Fastify's startup cost never counts against a
// test's timeout (#83).
const { app, store, lines } = buildSeededWorldApp();

beforeEach(() => {
  lines.length = 0;
  Object.assign(store, buildSeedAcademicStore(), scheduleStore(), { plans: [], planRevisions: [] });
});

/**
 * Saves the first option as the student and returns the saved plan.
 *
 * @returns The plan at revision 1.
 */
async function savedPlan() {
  const body = saveBodyFor(await viewOptions(app));
  return readPlan(await postSave(app, { studentId: STUDENTS.own.id, token: TOKENS.student, body }));
}

/**
 * Revalidates a plan as the student.
 *
 * @param planId - The plan.
 * @param expectedRevision - The revision the client saw.
 * @returns The injected response.
 */
function revalidate(planId: string, expectedRevision = 1) {
  return postRevalidate(app, { planId, body: { expectedRevision } });
}

describe('POST /v1/students/:studentId/plans/:planId/revalidate', () => {
  it('appends a REVALIDATED revision 2 on unchanged inputs, deep-equal to revision 1', async () => {
    const first = await savedPlan();

    const response = await revalidate(first.id);

    expect(response.statusCode).toBe(201);
    const second = readPlan(response);
    expect(second.id).toBe(first.id);
    expect(second.latest.revision).toBe(2);
    expect(second.latest.cause).toBe(PlanRevisionCause.Revalidated);
    expect(second.latest.result).toEqual(first.latest.result);
    expect(second.latest.selectedSectionIds).toEqual(first.latest.selectedSectionIds);
    expect(second.revisions.map((entry) => entry.revision)).toEqual([1, 2]);
  });

  it('makes revision 2 CURRENT after a superseded section snapshot, while revision 1 stays STALE', async () => {
    const first = await savedPlan();
    store.sectionSnapshots = [
      buildScheduleSnapshot(undefined, { sourceEffectiveAt: '2026-09-01T06:00:00.000Z', seed: 2 }),
    ];
    const before = readRevision(await getPlans(app, `/${first.id}/revisions/1`));
    expect(before.freshness.state).toBe(PlanFreshness.Stale);

    const second = readPlan(await revalidate(first.id));

    expect(second.latest.freshness.state).toBe(PlanFreshness.Current);
    expect(second.latest.result?.pinnedInputs.sectionSnapshotId).not.toBe(
      first.latest.result?.pinnedInputs.sectionSnapshotId,
    );
    const after = readRevision(await getPlans(app, `/${first.id}/revisions/1`));
    expect(after.freshness.state).toBe(PlanFreshness.Stale);
  });

  it('leaves revision 1 exactly as stored', async () => {
    const first = await savedPlan();
    const stored = structuredClone(store.planRevisions?.[0]);

    await revalidate(first.id);

    expect(store.planRevisions).toHaveLength(2);
    expect(store.planRevisions?.[0]).toEqual(stored);
  });

  it('carries the selection over when the same section set is still an option', async () => {
    const first = await savedPlan();

    const second = readPlan(await revalidate(first.id));

    expect(second.latest.selectedSectionIds).toEqual(first.latest.selectedSectionIds);
  });

  it('sets a null selection when a selected section is withdrawn, never another section', async () => {
    const first = await savedPlan();
    const withdrawn = firstOf(first.latest.selectedSectionIds ?? undefined);
    const kept = (store.sectionSnapshots?.[0]?.sections ?? []).filter(
      (section) => section.id !== withdrawn,
    );
    store.sectionSnapshots = [
      buildScheduleSnapshot(kept, { sourceEffectiveAt: '2026-09-01T06:00:00.000Z', seed: 2 }),
    ];

    const response = await revalidate(first.id);

    expect(response.statusCode).toBe(201);
    expect(readPlan(response).latest.selectedSectionIds).toBeNull();
  });

  it('returns 409 REVISION_CONFLICT for an expectedRevision that is not the latest', async () => {
    const first = await savedPlan();
    await revalidate(first.id);

    const response = await revalidate(first.id, 1);

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).code).toBe(ErrorCode.RevisionConflict);
    expect(store.planRevisions).toHaveLength(2);
  });

  it('gives 201 to one and 409 to the other of two revalidations from the same revision', async () => {
    const first = await savedPlan();

    const responses = await Promise.all([revalidate(first.id), revalidate(first.id)]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(store.planRevisions).toHaveLength(2);
  });

  it('returns 409 STALE_SOURCE and writes nothing when the current sections are too old', async () => {
    const first = await savedPlan();
    store.sectionSnapshots = [
      buildScheduleSnapshot(undefined, { sourceEffectiveAt: '2026-08-01T00:00:00.000Z', seed: 2 }),
    ];

    const response = await revalidate(first.id);

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).code).toBe(ErrorCode.StaleSource);
    expect(store.planRevisions).toHaveLength(1);
  });

  it('returns 503 SOURCE_UNAVAILABLE and writes nothing when no sections are published', async () => {
    const first = await savedPlan();
    store.sectionSnapshots = [];

    const response = await revalidate(first.id);

    expect(response.statusCode).toBe(503);
    expect(readError(response.json()).code).toBe(ErrorCode.SourceUnavailable);
    expect(store.planRevisions).toHaveLength(1);
  });

  it('returns 409 STALE_SOURCE and writes nothing when the audit is tied for latest', async () => {
    const first = await savedPlan();
    const audit = firstOf(store.audits);
    store.audits = [...(store.audits ?? []), { ...audit, id: buildAuditSnapshot({}, 99).id }];

    const response = await revalidate(first.id);

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).code).toBe(ErrorCode.StaleSource);
    expect(store.planRevisions).toHaveLength(1);
  });

  it('logs the revalidation with opaque IDs only', async () => {
    const first = await savedPlan();

    await revalidate(first.id);

    const recorded = readLogLines(lines).filter((line) => line.msg === 'plan draft revalidated');
    expect(recorded.at(-1)).toMatchObject({ revision: 2 });
    expect(lines.join('')).not.toContain(STUDENTS.own.sourceStudentId);
  });
});

describe('POST /v1/students/:studentId/plans/:planId/revalidate refusals write nothing', () => {
  it('returns 401 without a session', async () => {
    const first = await savedPlan();

    const response = await postRevalidate(app, {
      planId: first.id,
      token: null,
      body: { expectedRevision: 1 },
    });

    expect(response.statusCode).toBe(401);
  });

  it.each([
    ['an assigned advisor', STUDENTS.own.id, TOKENS.advisor],
    ['an admin of the same tenant', STUDENTS.own.id, TOKENS.tenantAdmin],
    ['an admin of another tenant', STUDENTS.own.id, TOKENS.admin],
    ['the student for another student', STUDENTS.other.id, TOKENS.student],
    ['the student for an ID that is not a UUID', 'not-a-uuid', TOKENS.student],
  ])('returns 404 NOT_FOUND to %s', async (_case, studentId, token) => {
    const first = await savedPlan();

    const response = await postRevalidate(app, {
      studentId,
      planId: first.id,
      token,
      body: { expectedRevision: 1 },
    });

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
    expect(store.planRevisions).toHaveLength(1);
  });

  it.each([
    ['a plan that does not exist', '3f0d6b52-7a5e-4d0a-9b8c-0a1b2c3d4e5f'],
    ['an ID that is not a UUID', 'not-a-uuid'],
  ])('returns 404 NOT_FOUND for %s', async (_case, planId) => {
    await savedPlan();

    const response = await revalidate(planId);

    expect(response.statusCode).toBe(404);
    expect(store.planRevisions).toHaveLength(1);
  });

  it.each([
    ['a tenant field', { tenantId: SYNTHETIC_TENANTS.b.id }],
    ['a user field', { userId: STUDENTS.other.id }],
    ['a role field', { roles: ['ADMIN'] }],
    ['a client result', { result: { outcome: 'OPTIONS_FOUND' } }],
    ['client inputs', { request: { courseIds: [] } }],
    ['a revision of zero', { expectedRevision: 0 }],
    ['no expected revision', { expectedRevision: undefined }],
  ])('returns 400 INVALID_REQUEST for a body with %s', async (_case, extra) => {
    const first = await savedPlan();

    const response = await postRevalidate(app, {
      planId: first.id,
      body: { expectedRevision: 1, ...extra },
    });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).code).toBe(ErrorCode.InvalidRequest);
    expect(store.planRevisions).toHaveLength(1);
  });
});
