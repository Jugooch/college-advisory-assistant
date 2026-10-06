/**
 * @file HTTP-level tests for `GET /v1/students/:studentId/plannable-terms`: each role, 401,
 * NOT_FOUND that doesn't reveal existence, other tenants, fresh, stale, tied and empty terms,
 * the 24-hour boundary, and an ignored tenant in the query and headers.
 * @requirement FR-08
 * @requirement NFR-01
 * @requirement NFR-04
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { PlannableTermsResponseSchema } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { buildSectionSnapshot, buildStudent, buildTerm, SYNTHETIC_TENANTS } from '@caa/test-kit';

import {
  bearer,
  buildWorldApp,
  readError,
  STUDENTS,
  TEST_NOW,
  TOKENS,
} from '../../testing/fixtures';

const { app, store } = buildWorldApp();

const FALL = buildTerm({ termCode: '2026FA', sequence: 1 }, 1);
const SPRING = buildTerm({ termCode: '2027SP', sequence: 2 }, 2);
const FOREIGN = buildTerm({ tenantId: SYNTHETIC_TENANTS.b.id, termCode: '2027SP' }, 3);
const FRESH = '2026-09-01T12:00:00.000Z';

/**
 * Publishes one snapshot for a term.
 *
 * @param termId - The term.
 * @param sourceEffectiveAt - Source time.
 * @param seed - Drives the snapshot ID, so two snapshots can tie.
 * @returns The snapshot.
 */
function snapshot(termId: string, sourceEffectiveAt: string, seed: number) {
  return buildSectionSnapshot({ termId, sourceEffectiveAt }, seed);
}

beforeEach(() => {
  store.terms = [FALL, SPRING, FOREIGN];
  store.sectionSnapshots = [snapshot(FALL.id, FRESH, 1), snapshot(SPRING.id, FRESH, 2)];
});

/**
 * Gets the plannable terms.
 *
 * @param studentId - Path param, sent as-is.
 * @param token - Dev token, or null for no session.
 * @param extra - Extra query string and headers.
 * @param extra.query - Query string, with its leading `?`.
 * @param extra.headers - Extra headers.
 * @returns The injected response.
 */
function getTerms(
  studentId: string,
  token: string | null,
  { query = '', headers = {} }: { query?: string; headers?: Record<string, string> } = {},
) {
  return app.inject({
    method: 'GET',
    url: `/v1/students/${studentId}/plannable-terms${query}`,
    headers: { ...(token === null ? {} : bearer(token)), ...headers },
  });
}

/**
 * Reads the term codes of a successful response, checking it against the contract.
 *
 * @param body - Parsed response body.
 * @returns The term codes in order.
 */
function readCodes(body: unknown): string[] {
  const data = PlannableTermsResponseSchema.parse((body as { data: unknown }).data);
  return data.terms.map((term) => term.termCode);
}

describe('GET /v1/students/:studentId/plannable-terms', () => {
  it('lists fresh terms in sequence order for the student themself', async () => {
    const response = await getTerms(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(200);
    expect(readCodes(response.json())).toEqual(['2026FA', '2027SP']);
  });

  it.each([
    ['an assigned advisor', TOKENS.advisor],
    ['an admin of the same tenant', TOKENS.tenantAdmin],
  ])('lists terms for %s', async (_role, token) => {
    expect((await getTerms(STUDENTS.own.id, token)).statusCode).toBe(200);
  });

  it.each([
    ['an advisor for an unassigned student', STUDENTS.other.id, TOKENS.advisor],
    ['a student asking for another student', STUDENTS.other.id, TOKENS.student],
    ['an admin of another tenant', STUDENTS.own.id, TOKENS.admin],
    ['a student who does not exist', buildStudent({}, 99).id, TOKENS.tenantAdmin],
    ['an ID that is not a UUID', 'not-a-uuid', TOKENS.tenantAdmin],
  ])('returns 404 NOT_FOUND to %s', async (_case, studentId, token) => {
    const response = await getTerms(studentId, token);

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
  });

  it('returns 401 without a session', async () => {
    expect((await getTerms(STUDENTS.own.id, null)).statusCode).toBe(401);
  });

  it('leaves out a stale term and a tied term', async () => {
    store.sectionSnapshots = [
      snapshot(FALL.id, '2026-08-01T00:00:00.000Z', 1),
      snapshot(SPRING.id, FRESH, 2),
      snapshot(SPRING.id, FRESH, 3),
    ];

    const response = await getTerms(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(200);
    expect(readCodes(response.json())).toEqual([]);
  });

  it.each([
    ['exactly 24 hours old', '2026-08-31T12:00:00.000Z', ['2026FA', '2027SP']],
    ['1 ms past 24 hours', '2026-08-31T11:59:59.999Z', ['2027SP']],
  ])('judges a head %s', async (_case, time, codes) => {
    store.sectionSnapshots = [snapshot(FALL.id, time, 1), snapshot(SPRING.id, FRESH, 2)];

    const response = await getTerms(STUDENTS.own.id, TOKENS.student);

    expect(TEST_NOW.toISOString()).toBe('2026-09-01T12:00:00.000Z');
    expect(readCodes(response.json())).toEqual(codes);
  });

  it('returns 200 with an empty list when no term has a snapshot', async () => {
    store.sectionSnapshots = [];

    const response = await getTerms(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ data: { terms: [] } });
  });

  it("lists only the session's tenant, ignoring a tenant in the query and headers", async () => {
    store.sectionSnapshots = [
      buildSectionSnapshot(
        { termId: FOREIGN.id, sourceEffectiveAt: FRESH, tenantId: SYNTHETIC_TENANTS.b.id },
        4,
      ),
      snapshot(SPRING.id, FRESH, 2),
    ];

    const response = await getTerms(STUDENTS.own.id, TOKENS.student, {
      query: `?tenantId=${SYNTHETIC_TENANTS.b.id}`,
      headers: { 'x-tenant-id': SYNTHETIC_TENANTS.b.id },
    });

    expect(response.statusCode).toBe(200);
    expect(readCodes(response.json())).toEqual(['2027SP']);
  });
});
