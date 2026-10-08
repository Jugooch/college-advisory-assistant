/**
 * @file HTTP-level tests for `GET /v1/advisor/cases`: an assigned advisor's queue oldest first,
 * the assignment window at the injected clock, the admin-only unrouted view, 404 for a student,
 * 400 and 401, and rows with no user ID, note or name.
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement AC15
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CaseQueueResponseSchema } from '@caa/api-contract';
import { CaseStatus, ErrorCode } from '@caa/domain';
import { buildAdvisingCase, buildInReviewAdvisingCase, syntheticId } from '@caa/test-kit';

import { buildCasesWorld, getPath, NOTE } from '../../testing/cases-harness';
import { IDENTITIES, readError, STUDENTS, TOKENS } from '../../testing/fixtures';

const { app, store, reset } = buildCasesWorld();
const URL = '/v1/advisor/cases';

beforeEach(() => {
  reset();
  store.cases = [
    buildAdvisingCase(
      { studentId: STUDENTS.own.id, createdAt: '2026-09-01T09:00:00.000Z', studentNote: NOTE },
      1,
    ),
    buildInReviewAdvisingCase(
      {
        studentId: STUDENTS.own.id,
        createdAt: '2026-09-01T07:00:00.000Z',
        planRevisionId: syntheticId('planRevision', 2),
        ownerUserId: IDENTITIES.advisor.id,
      },
      2,
    ),
    buildAdvisingCase(
      {
        studentId: STUDENTS.other.id,
        createdAt: '2026-09-01T08:00:00.000Z',
        planRevisionId: syntheticId('planRevision', 3),
      },
      3,
    ),
  ];
});

/**
 * Reads the queue rows from a response.
 *
 * @param response - The injected response.
 * @returns The rows.
 */
function rowsOf(response: { json: () => unknown }) {
  return CaseQueueResponseSchema.parse(z.object({ data: z.unknown() }).parse(response.json()).data)
    .cases;
}

describe('GET /v1/advisor/cases', () => {
  it('lists the assigned student’s cases oldest first, with ownership as a flag', async () => {
    const response = await getPath(app, URL, TOKENS.advisor);

    expect(response.statusCode).toBe(200);
    expect(rowsOf(response).map((row) => [row.status, row.ownerIsYou, row.routed])).toEqual([
      [CaseStatus.InReview, true, true],
      [CaseStatus.Open, false, true],
    ]);
  });

  it('filters by status', async () => {
    const rows = rowsOf(await getPath(app, `${URL}?status=OPEN`, TOKENS.advisor));

    expect(rows.map((row) => row.status)).toEqual([CaseStatus.Open]);
  });

  it('carries no user ID, tenant, student note or name in any row', async () => {
    const raw = (await getPath(app, URL, TOKENS.advisor)).body;

    for (const identity of Object.values(IDENTITIES)) {
      expect(raw).not.toContain(identity.id);
    }
    expect(raw).not.toContain(NOTE);
    expect(raw).not.toContain('studentNote');
  });

  it('stops listing a student’s cases once the assignment has ended', async () => {
    store.assignments = store.assignments.map((assignment) => ({
      ...assignment,
      effectiveTo: '2026-09-01T12:00:00.000Z',
    }));

    expect(rowsOf(await getPath(app, URL, TOKENS.advisor))).toEqual([]);
  });

  it('shows an admin the unrouted open cases, marked not routed', async () => {
    const rows = rowsOf(await getPath(app, `${URL}?unrouted=true`, TOKENS.tenantAdmin));

    expect(rows.map((row) => [row.studentId, row.routed])).toEqual([[STUDENTS.other.id, false]]);
  });

  it('answers 404 to an advisor asking for the unrouted view', async () => {
    const response = await getPath(app, `${URL}?unrouted=true`, TOKENS.advisor);

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
  });

  it('answers 404 to a student, and an empty queue to an admin of another tenant', async () => {
    expect((await getPath(app, URL, TOKENS.student)).statusCode).toBe(404);
    expect(rowsOf(await getPath(app, URL, TOKENS.admin))).toEqual([]);
  });

  it.each(['status=NOPE', 'unrouted=maybe', 'tenantId=x'])('answers 400 for ?%s', async (query) => {
    const response = await getPath(app, `${URL}?${query}`, TOKENS.advisor);

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).code).toBe(ErrorCode.InvalidRequest);
  });

  it('answers 401 without a session', async () => {
    expect((await app.inject({ method: 'GET', url: URL })).statusCode).toBe(401);
  });
});
