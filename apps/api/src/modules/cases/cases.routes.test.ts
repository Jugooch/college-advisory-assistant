/**
 * @file HTTP-level tests for creating a case and listing the student's cases: the OPEN case with
 * its CREATE event, the frozen context and its freshness, the second-open-case 409, safe logs,
 * and the newest-first list that carries no note or owner.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-15
 * @requirement FR-17
 * @requirement AC16
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CaseListResponseSchema } from '@caa/api-contract';
import {
  CaseAction,
  CaseReason,
  CaseStatus,
  DiscrepancySubject,
  ErrorCode,
  PlanFreshness,
  PlanStaleReason,
  Role,
} from '@caa/domain';
import { buildAdvisingCase, syntheticId } from '@caa/test-kit';

import {
  buildCasesWorld,
  createAsStudent,
  getPath,
  NOTE,
  postCase,
  readCase,
  reviewBody,
  savedRevisionId,
} from '../../testing/cases-harness';
import { readLogLines } from '../../testing/course-checks-harness';
import { readError, STUDENTS, TOKENS } from '../../testing/fixtures';
import { postSave, saveBodyFor, viewOptions } from '../../testing/plan-drafts-harness';
import { buildScheduleSnapshot } from '../../testing/schedule-options-harness';

const { app, store, lines, reset } = buildCasesWorld();

beforeEach(reset);

describe('POST /v1/students/:studentId/cases', () => {
  it('creates an OPEN case and its CREATE event, timed by the injected clock', async () => {
    const view = await createAsStudent(app);

    expect(view).toMatchObject({
      status: CaseStatus.Open,
      reason: CaseReason.PlanReview,
      studentNote: NOTE,
      studentId: STUDENTS.own.id,
      lastSequence: 1,
      owner: null,
      allowedActions: [CaseAction.Withdraw],
    });
    expect(view.events).toEqual([
      expect.objectContaining({
        action: CaseAction.Create,
        actorRole: Role.Student,
        isYou: true,
        at: '2026-09-01T12:00:00.000Z',
        fromStatus: null,
        toStatus: CaseStatus.Open,
      }),
    ]);
    expect(view.createdAt).toBe('2026-09-01T12:00:00.000Z');
    expect(store.caseEvents?.[0]).toMatchObject({ actorRole: Role.Student });
    expect(store.cases).toHaveLength(1);
    expect(store.caseEvents).toHaveLength(1);
  });
  it('freezes the saved revision exactly as stored, with freshness at read time', async () => {
    const revisionId = await savedRevisionId(app);
    const saved = (store.planRevisions ?? [])[0];

    const view = readCase(
      await postCase(app, {
        studentId: STUDENTS.own.id,
        token: TOKENS.student,
        body: reviewBody(revisionId),
      }),
    );

    expect(view.planRevisionId).toBe(revisionId);
    expect(view.context).toMatchObject({
      id: revisionId,
      revision: 1,
      result: saved?.result,
      freshness: { state: PlanFreshness.Current },
    });
  });
  it('accepts a case from a stale revision, and its context shows STALE', async () => {
    const revisionId = await savedRevisionId(app);
    store.sectionSnapshots = [
      ...(store.sectionSnapshots ?? []),
      buildScheduleSnapshot(undefined, { sourceEffectiveAt: '2026-09-01T06:00:00.000Z', seed: 2 }),
    ];

    const response = await postCase(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: reviewBody(revisionId),
    });

    expect(response.statusCode).toBe(201);
    expect(readCase(response).context?.freshness).toMatchObject({
      state: PlanFreshness.Stale,
      reasons: [PlanStaleReason.SectionsSuperseded],
    });
  });
  it('keeps showing the frozen revision after the plan gets a newer one', async () => {
    const first = await createAsStudent(app);
    await postSave(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: saveBodyFor(await viewOptions(app)),
    });
    expect(store.planRevisions).toHaveLength(2);

    const read = readCase(await getPath(app, `/v1/cases/${first.id}`, TOKENS.student));

    expect(read.context).toMatchObject({ id: first.planRevisionId, revision: 1 });
  });
  it('accepts a source discrepancy without a revision, with a null context', async () => {
    const response = await postCase(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: reviewBody(null, {
        reason: CaseReason.SourceDiscrepancy,
        discrepancySubject: DiscrepancySubject.CourseAttempt,
      }),
    });

    expect(response.statusCode).toBe(201);
    expect(readCase(response)).toMatchObject({
      reason: CaseReason.SourceDiscrepancy,
      planRevisionId: null,
      context: null,
    });
  });
  it('refuses a second open case on the same plan with 409 REVISION_CONFLICT', async () => {
    const first = await createAsStudent(app);

    const response = await postCase(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: reviewBody(first.planRevisionId),
    });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).code).toBe(ErrorCode.RevisionConflict);
    expect(store.cases).toHaveLength(1);
  });
  it('allows a new case after the earlier one was withdrawn', async () => {
    const first = await createAsStudent(app);
    store.cases = (store.cases ?? []).map((entry) => ({
      ...entry,
      status: CaseStatus.Withdrawn,
      ownerUserId: null,
    }));

    const response = await postCase(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: reviewBody(first.planRevisionId),
    });

    expect(response.statusCode).toBe(201);
  });
  it('logs ids, reason and status, never the student note', async () => {
    await createAsStudent(app);

    const created = readLogLines(lines).find((line) => line.msg === 'advisor case created');
    expect(created).toMatchObject({ reason: CaseReason.PlanReview, status: CaseStatus.Open });
    expect(lines.join('\n')).not.toContain(NOTE);
  });
  it('sends nothing and writes nothing outside the app: only case rows change', async () => {
    const before = { students: store.students, assignments: store.assignments };

    await createAsStudent(app);

    expect(store.students).toEqual(before.students);
    expect(store.assignments).toEqual(before.assignments);
  });
});

describe('GET /v1/students/:studentId/cases', () => {
  /**
   * Lists the own student's cases.
   *
   * @param token - Dev token.
   * @param studentId - Student whose cases are listed; the signed-in student by default.
   * @returns The injected response.
   */
  const list = (token: string, studentId: string = STUDENTS.own.id) =>
    getPath(app, `/v1/students/${studentId}/cases`, token);

  it('lists the student’s cases newest first, without notes or owners', async () => {
    store.cases = [
      buildAdvisingCase({ studentId: STUDENTS.own.id, createdAt: '2026-09-01T08:00:00.000Z' }, 1),
      buildAdvisingCase(
        {
          studentId: STUDENTS.own.id,
          createdAt: '2026-09-01T10:00:00.000Z',
          planRevisionId: syntheticId('planRevision', 2),
        },
        2,
      ),
    ];

    const body = CaseListResponseSchema.parse(
      z.object({ data: z.unknown() }).parse((await list(TOKENS.student)).json()).data,
    );

    expect(body.cases.map((row) => row.createdAt)).toEqual([
      '2026-09-01T10:00:00.000Z',
      '2026-09-01T08:00:00.000Z',
    ]);
    expect(JSON.stringify(body)).not.toContain('studentNote');
    expect(JSON.stringify(body)).not.toContain('owner');
  });

  it.each([
    ['the student', TOKENS.student, 200],
    ['an assigned advisor', TOKENS.advisor, 200],
    ['a tenant admin', TOKENS.tenantAdmin, 200],
    ['an admin of another tenant', TOKENS.admin, 404],
  ])('answers %s with %i', async (_name, token, status) => {
    expect((await list(token)).statusCode).toBe(status);
  });

  it('answers 404 for a student the actor may not see', async () => {
    expect((await list(TOKENS.student, STUDENTS.other.id)).statusCode).toBe(404);
    expect((await list(TOKENS.advisor, STUDENTS.other.id)).statusCode).toBe(404);
  });

  it('answers 404 for a malformed student ID', async () => {
    expect((await list(TOKENS.student, 'not-an-id')).statusCode).toBe(404);
  });
});
