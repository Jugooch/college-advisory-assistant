/**
 * @file HTTP-level tests for `POST /v1/cases/:caseId/events`: claim, release, resolve and
 * withdraw end to end with the status the case logic gives, racing claims, a revoked assignment,
 * and a resolution that changes nothing but the case.
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-15
 * @requirement AC15
 * @requirement AC36
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { CaseAction, CaseResolution, CaseStatus, ErrorCode, Role } from '@caa/domain';

import {
  buildCasesWorld,
  createAsStudent,
  eventBody,
  getPath,
  postEvent,
  readCase,
} from '../../testing/cases-harness';
import { readLogLines } from '../../testing/course-checks-harness';
import { IDENTITIES, readError, TOKENS } from '../../testing/fixtures';

const { app, store, lines, reset } = buildCasesWorld();
const NOTE = 'Reviewed with the student; a synthetic note the student may read.';
const resolveBody = (expectedSequence: number) =>
  eventBody(CaseAction.Resolve, expectedSequence, {
    resolution: CaseResolution.PlanReviewed,
    note: NOTE,
  });

beforeEach(reset);

/**
 * Creates a case as the student and has the assigned advisor claim it.
 *
 * @returns The case ID.
 */
async function claimed(): Promise<string> {
  const created = await createAsStudent(app);
  const response = await postEvent(app, {
    caseId: created.id,
    token: TOKENS.advisor,
    body: eventBody(CaseAction.Claim, 1),
  });
  expect(response.statusCode).toBe(201);
  return created.id;
}

describe('POST /v1/cases/:caseId/events actions', () => {
  it('lets the assigned advisor claim: IN_REVIEW, owner is you, sequence 2, one log line', async () => {
    const created = await createAsStudent(app);

    const response = await postEvent(app, {
      caseId: created.id,
      token: TOKENS.advisor,
      body: eventBody(CaseAction.Claim, 1),
    });

    expect(response.statusCode).toBe(201);
    expect(readCase(response)).toMatchObject({
      status: CaseStatus.InReview,
      owner: { role: Role.Advisor, isYou: true },
      lastSequence: 2,
      allowedActions: [CaseAction.Release, CaseAction.Resolve],
    });
    expect(store.caseEvents?.at(-1)).toMatchObject({
      action: CaseAction.Claim,
      sequence: 2,
      actorUserId: IDENTITIES.advisor.id,
    });
    expect(readLogLines(lines).filter((line) => line.msg === 'advisor case action')).toHaveLength(
      1,
    );
  });

  it('stores each event role from the session, and shows an admin CLAIM as ADMIN to the student', async () => {
    const created = await createAsStudent(app);
    const steps: readonly [string, string, number][] = [
      [TOKENS.tenantAdmin, CaseAction.Claim, 1],
      [TOKENS.tenantAdmin, CaseAction.Release, 2],
      [TOKENS.advisor, CaseAction.Claim, 3],
    ];
    for (const [token, action, expectedSequence] of steps) {
      await postEvent(app, {
        caseId: created.id,
        token,
        body: eventBody(action, expectedSequence),
      });
    }
    await postEvent(app, { caseId: created.id, token: TOKENS.advisor, body: resolveBody(4) });

    expect(store.caseEvents?.map((event) => event.actorRole)).toEqual([
      Role.Student,
      Role.Admin,
      Role.Admin,
      Role.Advisor,
      Role.Advisor,
    ]);
    const seen = readCase(await getPath(app, `/v1/cases/${created.id}`, TOKENS.student));
    expect(seen.events[1]?.actorRole).toBe(Role.Admin);
    expect(seen.owner).toEqual({ role: Role.Advisor, isYou: false });
  });

  it('stores STUDENT on a withdraw and ADMIN as the owner role while an admin holds the claim', async () => {
    const created = await createAsStudent(app);
    await postEvent(app, {
      caseId: created.id,
      token: TOKENS.tenantAdmin,
      body: eventBody(CaseAction.Claim, 1),
    });
    expect(readCase(await getPath(app, `/v1/cases/${created.id}`, TOKENS.student)).owner).toEqual({
      role: Role.Admin,
      isYou: false,
    });

    await postEvent(app, {
      caseId: created.id,
      token: TOKENS.student,
      body: eventBody(CaseAction.Withdraw, 2),
    });

    expect(store.caseEvents?.at(-1)).toMatchObject({ actorRole: Role.Student });
  });

  it('refuses a body carrying actorRole with 400 and writes nothing', async () => {
    const created = await createAsStudent(app);

    const response = await postEvent(app, {
      caseId: created.id,
      token: TOKENS.advisor,
      body: eventBody(CaseAction.Claim, 1, { actorRole: Role.Admin }),
    });

    expect(response.statusCode).toBe(400);
    expect(store.caseEvents).toHaveLength(1);
  });

  it('lets the student see the claim with the owner as a role and no user ID', async () => {
    const caseId = await claimed();

    const response = await getPath(app, `/v1/cases/${caseId}`, TOKENS.student);

    expect(response.body).not.toContain(IDENTITIES.advisor.id);
    expect(readCase(response).owner).toEqual({
      role: Role.Advisor,
      isYou: false,
    });
  });

  it('lets an admin claim, and the owner release back to OPEN with no owner', async () => {
    const created = await createAsStudent(app);
    await postEvent(app, {
      caseId: created.id,
      token: TOKENS.tenantAdmin,
      body: eventBody(CaseAction.Claim, 1),
    });

    const response = await postEvent(app, {
      caseId: created.id,
      token: TOKENS.tenantAdmin,
      body: eventBody(CaseAction.Release, 2),
    });

    expect(readCase(response)).toMatchObject({ status: CaseStatus.Open, owner: null });
  });

  it('resolves for the owner, keeping the owner and showing the student resolution and note', async () => {
    const caseId = await claimed();

    const response = await postEvent(app, { caseId, token: TOKENS.advisor, body: resolveBody(2) });

    expect(readCase(response)).toMatchObject({
      status: CaseStatus.Resolved,
      owner: { role: Role.Advisor, isYou: true },
      allowedActions: [],
    });
    const seen = readCase(await getPath(app, `/v1/cases/${caseId}`, TOKENS.student));
    expect(seen.events.at(-1)).toMatchObject({
      action: CaseAction.Resolve,
      resolution: CaseResolution.PlanReviewed,
      note: NOTE,
    });
  });

  it('changes no plan, revision, assignment or student when a case is resolved', async () => {
    const caseId = await claimed();
    const before = {
      plans: store.plans,
      planRevisions: store.planRevisions,
      students: store.students,
      assignments: store.assignments,
    };

    await postEvent(app, { caseId, token: TOKENS.advisor, body: resolveBody(2) });

    expect({
      plans: store.plans,
      planRevisions: store.planRevisions,
      students: store.students,
      assignments: store.assignments,
    }).toEqual(before);
  });

  it('accepts a 1,000-character note and refuses 1,001 with 400', async () => {
    const caseId = await claimed();
    const resolveWith = (note: string) =>
      eventBody(CaseAction.Resolve, 2, { resolution: CaseResolution.PlanReviewed, note });

    const tooLong = await postEvent(app, {
      caseId,
      token: TOKENS.advisor,
      body: resolveWith('a'.repeat(1001)),
    });
    const fits = await postEvent(app, {
      caseId,
      token: TOKENS.advisor,
      body: resolveWith('a'.repeat(1000)),
    });

    expect(tooLong.statusCode).toBe(400);
    expect(fits.statusCode).toBe(201);
  });

  it.each([CaseStatus.Open, CaseStatus.InReview])(
    'lets the student withdraw from %s, clearing the owner',
    async (status) => {
      const created = await createAsStudent(app);
      const sequence = status === CaseStatus.Open ? 1 : 2;
      if (status === CaseStatus.InReview) {
        await postEvent(app, {
          caseId: created.id,
          token: TOKENS.advisor,
          body: eventBody(CaseAction.Claim, 1),
        });
      }

      const response = await postEvent(app, {
        caseId: created.id,
        token: TOKENS.student,
        body: eventBody(CaseAction.Withdraw, sequence),
      });

      expect(readCase(response)).toMatchObject({ status: CaseStatus.Withdrawn, owner: null });
    },
  );
});

describe('POST /v1/cases/:caseId/events race and revocation', () => {
  it('gives two claims from the same sequence one 201 and one 409 REVISION_CONFLICT', async () => {
    const created = await createAsStudent(app);
    const body = eventBody(CaseAction.Claim, 1);

    const first = await postEvent(app, { caseId: created.id, token: TOKENS.advisor, body });
    const second = await postEvent(app, { caseId: created.id, token: TOKENS.tenantAdmin, body });

    expect([first.statusCode, second.statusCode]).toEqual([201, 409]);
    expect(readError(second.json()).code).toBe(ErrorCode.RevisionConflict);
    expect(store.cases?.[0]?.ownerUserId).toBe(IDENTITIES.advisor.id);
    expect(store.caseEvents).toHaveLength(2);
  });

  it('answers 404 to the former owner resolving after the assignment ended, writing nothing', async () => {
    const caseId = await claimed();
    store.assignments = store.assignments.map((assignment) => ({
      ...assignment,
      effectiveTo: '2026-08-31T00:00:00.000Z',
    }));

    const response = await postEvent(app, { caseId, token: TOKENS.advisor, body: resolveBody(2) });

    expect(response.statusCode).toBe(404);
    expect(store.cases?.[0]?.status).toBe(CaseStatus.InReview);
    expect((await getPath(app, `/v1/cases/${caseId}`, TOKENS.advisor)).statusCode).toBe(404);
    expect(readCase(await getPath(app, `/v1/cases/${caseId}`, TOKENS.student)).status).toBe(
      CaseStatus.InReview,
    );
  });
});
