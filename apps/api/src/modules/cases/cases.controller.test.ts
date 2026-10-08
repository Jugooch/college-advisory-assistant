/**
 * @file HTTP-level tests for the case endpoints' refusals and the case detail: every 400, 404 and
 * 401 on create with nothing written, and who may read a case, the allowed actions per actor, and
 * that no user ID appears in a response.
 * @requirement FR-01
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-17
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { CaseAction, CaseReason, CaseStatus, ErrorCode, Role } from '@caa/domain';
import {
  buildAdvisingCase,
  buildCaseEvent,
  buildInReviewAdvisingCase,
  buildPlan,
  buildPlanRevision,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import {
  buildCasesWorld,
  createAsStudent,
  getPath,
  postCase,
  readCase,
  reviewBody,
  savedRevisionId,
} from '../../testing/cases-harness';
import { IDENTITIES, readError, STUDENTS, TOKENS } from '../../testing/fixtures';

const { app, store, reset } = buildCasesWorld();

beforeEach(reset);

describe('POST /v1/students/:studentId/cases refusals', () => {
  it.each([
    ['status', { status: CaseStatus.Resolved }],
    ['ownerUserId', { ownerUserId: IDENTITIES.advisor.id }],
    ['tenantId', { tenantId: SYNTHETIC_TENANTS.b.id }],
    ['userId', { userId: IDENTITIES.advisor.id }],
    ['role', { role: Role.Admin }],
  ])('refuses a body naming %s with 400 and writes nothing', async (_name, extra) => {
    const response = await postCase(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: reviewBody(await savedRevisionId(app), extra),
    });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).code).toBe(ErrorCode.InvalidRequest);
    expect(store.cases).toHaveLength(0);
  });
  it.each([
    ['a plan review without a revision', reviewBody(null)],
    ['a discrepancy without a subject', reviewBody(null, { reason: CaseReason.SourceDiscrepancy })],
    ['an empty note', reviewBody(syntheticId('planRevision', 1), { studentNote: '  ' })],
    ['no body', undefined],
  ])('refuses %s with 400', async (_name, body) => {
    const response = await postCase(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body,
    });

    expect(response.statusCode).toBe(400);
  });
  it.each([
    ['another student', STUDENTS.other.id, TOKENS.student],
    ['an assigned advisor', STUDENTS.own.id, TOKENS.advisor],
    ['an admin', STUDENTS.own.id, TOKENS.tenantAdmin],
    ['another tenant', STUDENTS.own.id, TOKENS.admin],
  ])('answers 404 to %s, writing nothing', async (_name, studentId, token) => {
    const revisionId = await savedRevisionId(app);

    const response = await postCase(app, { studentId, token, body: reviewBody(revisionId) });

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
    expect(store.cases).toHaveLength(0);
  });
  it('answers 404 for a revision that does not exist', async () => {
    const response = await postCase(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: reviewBody(syntheticId('planRevision', 99)),
    });

    expect(response.statusCode).toBe(404);
  });
  it('answers 404 for another student’s revision', async () => {
    const plan = buildPlan({ studentId: STUDENTS.other.id });
    store.plans = [plan];
    store.planRevisions = [{ revision: buildPlanRevision({ planId: plan.id }), result: {} }];

    const response = await postCase(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: reviewBody(store.planRevisions[0]?.revision.id ?? null),
    });

    expect(response.statusCode).toBe(404);
    expect(store.cases).toHaveLength(0);
  });
  it('answers 404 for a revision of another tenant', async () => {
    const plan = buildPlan({ tenantId: SYNTHETIC_TENANTS.b.id, studentId: STUDENTS.own.id });
    store.plans = [plan];
    store.planRevisions = [{ revision: buildPlanRevision({ planId: plan.id }), result: {} }];

    const response = await postCase(app, {
      studentId: STUDENTS.own.id,
      token: TOKENS.student,
      body: reviewBody(store.planRevisions[0]?.revision.id ?? null),
    });

    expect(response.statusCode).toBe(404);
    expect(store.cases).toHaveLength(0);
  });
  it('answers 401 without a session', async () => {
    const response = await postCase(app, {
      studentId: STUDENTS.own.id,
      token: null,
      body: reviewBody(null),
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /v1/cases/:caseId', () => {
  it('shows the student their case with WITHDRAW allowed', async () => {
    const created = await createAsStudent(app);

    const view = readCase(await getPath(app, `/v1/cases/${created.id}`, TOKENS.student));

    expect(view).toEqual(created);
  });

  it.each([
    ['an assigned advisor', TOKENS.advisor, [CaseAction.Claim]],
    ['a tenant admin', TOKENS.tenantAdmin, [CaseAction.Claim]],
  ])('shows %s the case with the reviewer’s actions', async (_name, token, actions) => {
    const created = await createAsStudent(app);

    const view = readCase(await getPath(app, `/v1/cases/${created.id}`, token));

    expect(view.allowedActions).toEqual(actions);
    expect(view.events[0]).toMatchObject({ actorRole: Role.Student, isYou: false });
  });

  it('shows the owning advisor RELEASE and RESOLVE, and the owner as you', async () => {
    const created = await createAsStudent(app);
    const inReview = buildInReviewAdvisingCase({
      id: created.id,
      studentId: STUDENTS.own.id,
      planRevisionId: created.planRevisionId,
      ownerUserId: IDENTITIES.advisor.id,
    });
    store.cases = [inReview];
    store.caseEvents = [
      buildCaseEvent({
        caseId: created.id,
        actorUserId: STUDENTS.own.userId ?? IDENTITIES.student.id,
        at: created.createdAt,
      }),
      buildCaseEvent(
        {
          caseId: created.id,
          sequence: 2,
          action: CaseAction.Claim,
          actorUserId: IDENTITIES.advisor.id,
          actorRole: Role.Advisor,
          fromStatus: CaseStatus.Open,
          toStatus: CaseStatus.InReview,
        },
        2,
      ),
    ];

    const view = readCase(await getPath(app, `/v1/cases/${created.id}`, TOKENS.advisor));

    expect(view.owner).toEqual({ role: Role.Advisor, isYou: true });
    expect(view.allowedActions).toEqual([CaseAction.Release, CaseAction.Resolve]);
    expect(view.events[1]).toMatchObject({ actorRole: Role.Advisor, isYou: true });
    const asStudent = readCase(await getPath(app, `/v1/cases/${created.id}`, TOKENS.student));
    expect(asStudent.owner).toEqual({ role: Role.Advisor, isYou: false });
    expect(asStudent.allowedActions).toEqual([CaseAction.Withdraw]);
  });

  it('contains no user ID anywhere in the response', async () => {
    const created = await createAsStudent(app);

    const raw = (await getPath(app, `/v1/cases/${created.id}`, TOKENS.advisor)).body;

    for (const identity of Object.values(IDENTITIES)) {
      expect(raw).not.toContain(identity.id);
    }
    expect(raw).not.toContain(SYNTHETIC_TENANTS.a.id);
  });

  it('answers 404, identical to a missing case, for everyone who may not see it', async () => {
    const created = await createAsStudent(app);
    store.students = store.students.map((student) =>
      student.id === STUDENTS.own.id ? { ...student, userId: IDENTITIES.advisor.id } : student,
    );
    const missing = await getPath(
      app,
      `/v1/cases/${syntheticId('advisingCase', 77)}`,
      TOKENS.student,
    );

    const stranger = await getPath(app, `/v1/cases/${created.id}`, TOKENS.student);

    expect(stranger.statusCode).toBe(404);
    expect(readError(stranger.json()).code).toBe(readError(missing.json()).code);
  });

  it('answers 404 to an unassigned advisor and to another tenant', async () => {
    const created = await createAsStudent(app);
    store.assignments = [];

    expect((await getPath(app, `/v1/cases/${created.id}`, TOKENS.advisor)).statusCode).toBe(404);
    expect((await getPath(app, `/v1/cases/${created.id}`, TOKENS.admin)).statusCode).toBe(404);
  });

  it('answers 404 to another student for a case on someone else’s record', async () => {
    const othersCase = buildAdvisingCase({ studentId: STUDENTS.other.id });
    store.cases = [othersCase];

    const response = await getPath(app, `/v1/cases/${othersCase.id}`, TOKENS.student);

    expect(response.statusCode).toBe(404);
  });

  it('answers 404 for a malformed case ID', async () => {
    expect((await getPath(app, '/v1/cases/not-an-id', TOKENS.student)).statusCode).toBe(404);
  });

  it('answers 404 once the advisor assignment has ended', async () => {
    const created = await createAsStudent(app);
    store.assignments = store.assignments.map((assignment) => ({
      ...assignment,
      effectiveTo: '2026-08-01T00:00:00.000Z',
    }));

    expect((await getPath(app, `/v1/cases/${created.id}`, TOKENS.advisor)).statusCode).toBe(404);
  });
});
