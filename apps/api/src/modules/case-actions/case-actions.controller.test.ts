/**
 * @file HTTP-level tests for the refusals of `POST /v1/cases/:caseId/events`: every 400, 404,
 * 409 and 401, with nothing written. A refused body never reaches the service, and an actor who
 * could never take the action gets the same 404 as a missing case.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { CaseAction, CaseResolution, CaseStatus, ErrorCode, Role } from '@caa/domain';
import { buildAdvisingCase, SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import {
  buildCasesWorld,
  createAsStudent,
  eventBody,
  postEvent,
} from '../../testing/cases-harness';
import { IDENTITIES, readError, STUDENTS, TOKENS } from '../../testing/fixtures';

const { app, store, reset } = buildCasesWorld();

beforeEach(reset);

describe('POST /v1/cases/:caseId/events body refusals', () => {
  it.each([
    ['a tenant', { tenantId: SYNTHETIC_TENANTS.b.id }],
    ['a user', { userId: IDENTITIES.advisor.id }],
    ['a role', { role: Role.Admin }],
    ['an owner', { ownerUserId: IDENTITIES.advisor.id }],
    ['a status', { status: CaseStatus.Resolved }],
  ])('refuses a body naming %s with 400, writing nothing', async (_name, extra) => {
    const created = await createAsStudent(app);

    const response = await postEvent(app, {
      caseId: created.id,
      token: TOKENS.advisor,
      body: eventBody(CaseAction.Claim, 1, extra),
    });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).code).toBe(ErrorCode.InvalidRequest);
    expect(store.caseEvents).toHaveLength(1);
  });

  it.each([
    ['CREATE', eventBody(CaseAction.Create, 1)],
    ['RESOLVE without a resolution', eventBody(CaseAction.Resolve, 1)],
    [
      'a resolution on CLAIM',
      eventBody(CaseAction.Claim, 1, { resolution: CaseResolution.PlanReviewed }),
    ],
    ['a note on CLAIM', eventBody(CaseAction.Claim, 1, { note: 'x' })],
    ['an unknown action', eventBody('WAIVE', 1)],
    ['no expectedSequence', { action: CaseAction.Claim }],
    ['no body', undefined],
  ])('refuses %s with 400', async (_name, body) => {
    const created = await createAsStudent(app);

    const response = await postEvent(app, { caseId: created.id, token: TOKENS.advisor, body });

    expect(response.statusCode).toBe(400);
    expect(store.caseEvents).toHaveLength(1);
  });
});

describe('POST /v1/cases/:caseId/events access refusals', () => {
  it.each([
    ['a student claiming', TOKENS.student, CaseAction.Claim],
    ['an advisor withdrawing', TOKENS.advisor, CaseAction.Withdraw],
    ['a non-owner releasing', TOKENS.advisor, CaseAction.Release],
    ['a non-owner resolving', TOKENS.advisor, CaseAction.Resolve],
    ['an admin of another tenant claiming', TOKENS.admin, CaseAction.Claim],
  ])('answers 404 to %s, writing nothing', async (_name, token, action) => {
    const created = await createAsStudent(app);
    const resolution =
      action === CaseAction.Resolve ? { resolution: CaseResolution.PlanReviewed } : {};

    const response = await postEvent(app, {
      caseId: created.id,
      token,
      body: eventBody(action, 1, resolution),
    });

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
    expect(store.caseEvents).toHaveLength(1);
  });

  it('answers 404 to an unassigned advisor claiming, writing nothing', async () => {
    const created = await createAsStudent(app);
    store.assignments = [];

    const response = await postEvent(app, {
      caseId: created.id,
      token: TOKENS.advisor,
      body: eventBody(CaseAction.Claim, 1),
    });

    expect(response.statusCode).toBe(404);
    expect(store.caseEvents).toHaveLength(1);
  });

  it('answers 404 for a case on another student’s record, a missing case and a malformed ID', async () => {
    const others = buildAdvisingCase({ studentId: STUDENTS.other.id });
    store.cases = [others];
    const body = eventBody(CaseAction.Claim, 1);

    for (const caseId of [others.id, syntheticId('advisingCase', 77), 'not-an-id']) {
      const response = await postEvent(app, { caseId, token: TOKENS.advisor, body });
      expect(response.statusCode).toBe(404);
    }
  });

  it('answers 401 without a session', async () => {
    const response = await postEvent(app, {
      caseId: syntheticId('advisingCase', 1),
      token: null,
      body: eventBody(CaseAction.Claim, 1),
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /v1/cases/:caseId/events status and sequence refusals', () => {
  it('answers 409 REVISION_CONFLICT for a stale expectedSequence, writing nothing', async () => {
    const created = await createAsStudent(app);

    const response = await postEvent(app, {
      caseId: created.id,
      token: TOKENS.advisor,
      body: eventBody(CaseAction.Claim, 7),
    });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).code).toBe(ErrorCode.RevisionConflict);
    expect(store.caseEvents).toHaveLength(1);
  });

  it.each([CaseStatus.Resolved, CaseStatus.Withdrawn])(
    'answers 400 to every action on a %s case, writing nothing',
    async (status) => {
      const created = await createAsStudent(app);
      store.cases = store.cases?.map((entry) => ({ ...entry, status })) ?? [];

      for (const [token, action] of [
        [TOKENS.advisor, CaseAction.Claim],
        [TOKENS.student, CaseAction.Withdraw],
      ] as const) {
        const response = await postEvent(app, {
          caseId: created.id,
          token,
          body: eventBody(action, 1),
        });
        expect(response.statusCode).toBe(400);
      }
      expect(store.caseEvents).toHaveLength(1);
    },
  );
});
