/**
 * @file HTTP-level tests for the plan read endpoints: list, read, and read a revision. Access
 * (student, assigned advisor, admin, and the 404s), freshness at read time (each stale reason, the
 * exact-age boundary, UNKNOWN on an unreadable source with the revision still returned), and a
 * stored result that no longer parses.
 * @requirement FR-02
 * @requirement FR-11
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC14
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { ErrorCode, PlanFreshness, PlanStaleReason } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import { buildRecordAudit, buildRecordSnapshot } from '../../testing/academic-fixtures';
import { buildSeededWorldApp, readLogLines } from '../../testing/course-checks-harness';
import { readError, STUDENTS, TEST_NOW, TOKENS } from '../../testing/fixtures';
import {
  getPlans,
  postSave,
  readPlan,
  readRevision,
  saveBodyFor,
  viewOptions,
} from '../../testing/plan-drafts-harness';
import { buildScheduleSnapshot, scheduleStore } from '../../testing/schedule-options-harness';
import { buildSeedAcademicStore } from '../../testing/seed-scenario-fixtures';

const MAX_AGE_MS = 86_400_000;
const reader = { failTransitions: false };
const { app, store, lines } = buildSeededWorldApp({
  campusTransitions: {
    findPolicy: () =>
      reader.failTransitions ? Promise.reject(new Error('db down')) : Promise.resolve(null),
  },
});

beforeEach(() => {
  lines.length = 0;
  reader.failTransitions = false;
  Object.assign(store, buildSeedAcademicStore(), scheduleStore(), { plans: [], planRevisions: [] });
});

/**
 * Saves the first option as the student, returning the saved plan.
 *
 * @returns The saved plan view.
 */
async function savePlan() {
  const body = saveBodyFor(await viewOptions(app));
  const response = await postSave(app, { studentId: STUDENTS.own.id, token: TOKENS.student, body });
  expect(response.statusCode).toBe(201);
  return readPlan(response);
}

/**
 * Changes a saved revision's stored fields, as a later contract or data change would.
 *
 * @param change - Fields to replace on every stored revision.
 */
function changeStored(
  change: Partial<NonNullable<typeof store.planRevisions>[number]['revision']>,
) {
  store.planRevisions = (store.planRevisions ?? []).map((stored) => ({
    ...stored,
    revision: { ...stored.revision, ...change },
  }));
}

describe('plan reads: access', () => {
  it.each([
    ['the student', TOKENS.student],
    ['an assigned advisor', TOKENS.advisor],
    ['an admin of the same tenant', TOKENS.tenantAdmin],
  ])('lets %s list, read, and read a revision', async (_case, token) => {
    const plan = await savePlan();

    const list = await getPlans(app, '', { token });
    const read = await getPlans(app, `/${plan.id}`, { token });
    const revision = await getPlans(app, `/${plan.id}/revisions/1`, { token });

    expect([list.statusCode, read.statusCode, revision.statusCode]).toEqual([200, 200, 200]);
    expect(readPlan(read)).toEqual(plan);
    expect(readRevision(revision)).toEqual(plan.latest);
    expect(list.json<{ data: { plans: unknown[] } }>().data.plans).toHaveLength(1);
  });

  it.each([
    ['an admin of another tenant', STUDENTS.own.id, TOKENS.admin],
    ['an advisor for an unassigned student', STUDENTS.other.id, TOKENS.advisor],
    ['the student for another student', STUDENTS.other.id, TOKENS.student],
    ['a student that does not exist', syntheticId('student', 99), TOKENS.tenantAdmin],
    ['an ID that is not a UUID', 'not-a-uuid', TOKENS.tenantAdmin],
  ])('returns 404 NOT_FOUND to %s on every endpoint', async (_case, studentId, token) => {
    const plan = await savePlan();

    for (const path of ['', `/${plan.id}`, `/${plan.id}/revisions/1`]) {
      const response = await getPlans(app, path, { studentId, token });
      expect(response.statusCode).toBe(404);
      expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
    }
  });

  it('returns 404 once the advisor assignment is revoked (AC15)', async () => {
    const plan = await savePlan();
    store.assignments = store.assignments.map((item) => ({
      ...item,
      effectiveTo: '2026-09-01T11:00:00.000Z',
    }));

    expect((await getPlans(app, `/${plan.id}`, { token: TOKENS.advisor })).statusCode).toBe(404);
  });

  it('returns 404 for a plan of another student, even for an admin who sees both', async () => {
    const plan = await savePlan();

    const response = await getPlans(app, `/${plan.id}`, {
      studentId: STUDENTS.other.id,
      token: TOKENS.tenantAdmin,
    });

    expect(response.statusCode).toBe(404);
  });

  it.each([
    ['an unknown plan', `/${syntheticId('plan', 77)}`],
    ['a malformed plan ID', '/not-a-uuid'],
    ['a revision that does not exist', '/PLAN/revisions/2'],
    ['revision 0', '/PLAN/revisions/0'],
    ['a non-numeric revision', '/PLAN/revisions/latest'],
    ['a negative revision', '/PLAN/revisions/-1'],
  ])('returns 404 for %s', async (_case, path) => {
    const plan = await savePlan();

    const response = await getPlans(app, path.replace('PLAN', plan.id));

    expect(response.statusCode).toBe(404);
  });

  it('returns 401 without a session', async () => {
    expect((await getPlans(app, '', { token: null })).statusCode).toBe(401);
  });
});

describe('plan reads: freshness at read time', () => {
  it('is CURRENT with no reasons right after a save', async () => {
    const plan = await savePlan();

    const read = readPlan(await getPlans(app, `/${plan.id}`));

    expect(read.latest.freshness).toEqual({
      state: PlanFreshness.Current,
      reasons: [],
      checkedAt: TEST_NOW.toISOString(),
    });
  });

  it('is STALE with SECTIONS_SUPERSEDED when newer sections are published, still returning the result', async () => {
    const plan = await savePlan();
    store.sectionSnapshots = [
      ...(store.sectionSnapshots ?? []),
      buildScheduleSnapshot(undefined, { sourceEffectiveAt: '2026-09-01T06:00:00.000Z', seed: 2 }),
    ];

    const read = readPlan(await getPlans(app, `/${plan.id}`));

    expect(read.latest.freshness).toMatchObject({
      state: PlanFreshness.Stale,
      reasons: [PlanStaleReason.SectionsSuperseded],
    });
    expect(read.latest.result).toEqual(plan.latest.result);
    expect(read.latest.createdAt).toBe(plan.latest.createdAt);
  });

  it('is STALE with STUDENT_RECORD_SUPERSEDED and AUDIT_SUPERSEDED when a newer record and audit arrive', async () => {
    const plan = await savePlan();
    const at = '2026-09-01T06:00:00.000Z';
    store.studentSnapshots = [
      ...(store.studentSnapshots ?? []),
      buildRecordSnapshot(
        { studentId: STUDENTS.own.id, sourceEffectiveAt: at, ingestedAt: at },
        88,
      ),
    ];
    store.audits = [
      ...(store.audits ?? []),
      buildRecordAudit(
        {
          studentId: STUDENTS.own.id,
          studentRecordEffectiveAt: at,
          generatedAt: '2026-09-01T09:00:00.000Z',
        },
        88,
      ),
    ];

    const read = readPlan(await getPlans(app, `/${plan.id}`));

    expect(read.latest.freshness).toMatchObject({
      state: PlanFreshness.Stale,
      reasons: [PlanStaleReason.StudentRecordSuperseded, PlanStaleReason.AuditSuperseded],
    });
  });

  it('is STALE with RULESET_CHANGED and TRANSITION_TABLE_CHANGED when those pins differ', async () => {
    const plan = await savePlan();
    changeStored({ rulesetVersion: 'demo-2025.9', campusTransitionVersion: 'old-table' });

    const read = readPlan(await getPlans(app, `/${plan.id}`));

    expect(read.latest.freshness).toMatchObject({
      state: PlanFreshness.Stale,
      reasons: [PlanStaleReason.RulesetChanged, PlanStaleReason.TransitionTableChanged],
    });
  });

  it('stays CURRENT exactly at the maximum age and turns STALE one millisecond later', async () => {
    const plan = await savePlan();
    const exactly = new Date(TEST_NOW.getTime() - MAX_AGE_MS).toISOString();
    const oneLater = new Date(TEST_NOW.getTime() - MAX_AGE_MS - 1).toISOString();

    changeStored({ studentRecordEffectiveAt: exactly });
    const atAge = readPlan(await getPlans(app, `/${plan.id}`));
    changeStored({ studentRecordEffectiveAt: oneLater });
    const past = readPlan(await getPlans(app, `/${plan.id}`));

    expect(atAge.latest.freshness.state).toBe(PlanFreshness.Current);
    expect(past.latest.freshness).toMatchObject({
      state: PlanFreshness.Stale,
      reasons: [PlanStaleReason.SourceExpired],
    });
  });

  it('is UNKNOWN with SOURCE_UNAVAILABLE when a source cannot be read, with the revision returned', async () => {
    const plan = await savePlan();
    reader.failTransitions = true;

    const response = await getPlans(app, `/${plan.id}`);

    expect(response.statusCode).toBe(200);
    const read = readPlan(response);
    expect(read.latest.freshness).toMatchObject({
      state: PlanFreshness.Unknown,
      reasons: [PlanStaleReason.SourceUnavailable],
    });
    expect(read.latest.result).toEqual(plan.latest.result);
    expect(read.latest.selectedSectionIds).toEqual(plan.latest.selectedSectionIds);
    expect(lines.join('')).not.toContain('db down');
  });

  it('is UNKNOWN with the revision returned when two section snapshots tie for latest', async () => {
    const plan = await savePlan();
    store.sectionSnapshots = [
      ...(store.sectionSnapshots ?? []),
      buildScheduleSnapshot(undefined, { seed: 3 }),
    ];

    const read = readPlan(await getPlans(app, `/${plan.id}`));

    expect(read.latest.freshness.state).toBe(PlanFreshness.Unknown);
    expect(read.latest.result).not.toBeNull();
  });

  it('shows freshness in the list and for a historical revision', async () => {
    const plan = await savePlan();
    store.sectionSnapshots = [
      ...(store.sectionSnapshots ?? []),
      buildScheduleSnapshot(undefined, { sourceEffectiveAt: '2026-09-01T06:00:00.000Z', seed: 2 }),
    ];

    const list = await getPlans(app, '');
    const revision = readRevision(await getPlans(app, `/${plan.id}/revisions/1`));

    expect(
      list.json<{ data: { plans: { freshness: { state: string } }[] } }>().data.plans[0]?.freshness
        .state,
    ).toBe(PlanFreshness.Stale);
    expect(revision.freshness.state).toBe(PlanFreshness.Stale);
  });
});

describe('plan reads: a stored result that no longer parses', () => {
  it('returns result null and resultUnavailable true, still 200 with the revision fields', async () => {
    const plan = await savePlan();
    store.planRevisions = (store.planRevisions ?? []).map((stored) => ({
      ...stored,
      result: { outcome: 'SOMETHING_ELSE' },
    }));

    const response = await getPlans(app, `/${plan.id}`);

    expect(response.statusCode).toBe(200);
    const read = readPlan(response);
    expect(read.latest).toMatchObject({ result: null, resultUnavailable: true, revision: 1 });
    expect(read.latest.selectedSectionIds).toEqual(plan.latest.selectedSectionIds);
    const warned = readLogLines(lines).find((line) => line.msg === 'stored plan result unreadable');
    expect(warned).toMatchObject({ planId: plan.id, revision: 1 });
    expect(JSON.stringify(warned)).not.toContain('SOMETHING_ELSE');
  });
});
