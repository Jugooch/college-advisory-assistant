/**
 * @file Tests for the advisor case endpoints and their list responses.
 */
import { describe, expect, it } from 'vitest';

import { createApiClient } from '../client/create-api-client';
import {
  addCaseEventEndpoint,
  CaseListResponseSchema,
  CaseQueueResponseSchema,
  createCaseEndpoint,
  getCaseEndpoint,
  listAdvisorCasesEndpoint,
  listStudentCasesEndpoint,
} from './cases.contract';

const EARLY = '2026-10-07T09:00:00.000-05:00';
const LATE = '2026-10-07T10:00:00.000-05:00';
const SAME_AS_LATE = '2026-10-07T16:00:00.000+01:00';
const ROW = {
  id: '4d5e6f70-0000-4000-8000-000000000001',
  reason: 'PLAN_REVIEW',
  planRevisionId: '5e6f7081-0000-4000-8000-000000000001',
  discrepancySubject: null,
  status: 'OPEN',
  createdAt: EARLY,
};
const QUEUE_ROW = {
  caseId: '4d5e6f70-0000-4000-8000-000000000001',
  studentId: '2b3c4d5e-0000-4000-8000-000000000001',
  reason: 'PLAN_REVIEW',
  status: 'OPEN',
  createdAt: EARLY,
  ownerIsYou: false,
  routed: true,
};

describe('case endpoints', () => {
  it('declares the five routes from ADR-0013 section 7', () => {
    expect(createCaseEndpoint).toMatchObject({
      method: 'POST',
      path: '/v1/students/:studentId/cases',
    });
    expect(listStudentCasesEndpoint).toMatchObject({
      method: 'GET',
      path: '/v1/students/:studentId/cases',
    });
    expect(getCaseEndpoint).toMatchObject({ method: 'GET', path: '/v1/cases/:caseId' });
    expect(listAdvisorCasesEndpoint).toMatchObject({ method: 'GET', path: '/v1/advisor/cases' });
    expect(addCaseEventEndpoint).toMatchObject({
      method: 'POST',
      path: '/v1/cases/:caseId/events',
    });
  });

  it('is callable through the generic typed client with a 201 response', async () => {
    const fetchFn = (): Promise<Response> =>
      Promise.resolve(Response.json({ data: { cases: [ROW] } }, { status: 201 }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn });

    const result = await client.call(listStudentCasesEndpoint, { params: { studentId: 'S-1' } });

    expect(result.cases).toHaveLength(1);
  });
});

describe('CaseListResponseSchema', () => {
  const accepts = (body: unknown): boolean => CaseListResponseSchema.safeParse(body).success;

  it('accepts an empty list and newest first, including equal instants', () => {
    expect(accepts({ cases: [] })).toBe(true);
    expect(accepts({ cases: [{ ...ROW, createdAt: LATE }, ROW] })).toBe(true);
    expect(
      accepts({
        cases: [
          { ...ROW, createdAt: LATE },
          { ...ROW, createdAt: SAME_AS_LATE },
        ],
      }),
    ).toBe(true);
  });

  it('rejects oldest first, comparing instants across offsets', () => {
    expect(accepts({ cases: [ROW, { ...ROW, createdAt: LATE }] })).toBe(false);
    expect(
      accepts({
        cases: [
          { ...ROW, createdAt: LATE },
          { ...ROW, createdAt: '2026-10-07T15:30:00.000+01:00' },
          { ...ROW, createdAt: '2026-10-07T15:31:00.000+01:00' },
        ],
      }),
    ).toBe(false);
  });

  it('rejects note text and owner IDs on a row', () => {
    expect(accepts({ cases: [{ ...ROW, studentNote: 'private' }] })).toBe(false);
    expect(accepts({ cases: [{ ...ROW, ownerUserId: 'u' }] })).toBe(false);
  });
});

describe('CaseQueueResponseSchema', () => {
  const accepts = (body: unknown): boolean => CaseQueueResponseSchema.safeParse(body).success;

  it('accepts an empty queue and oldest first', () => {
    expect(accepts({ cases: [] })).toBe(true);
    expect(accepts({ cases: [QUEUE_ROW, { ...QUEUE_ROW, createdAt: LATE }] })).toBe(true);
  });

  it('accepts an unrouted row and requires the routing flag', () => {
    expect(accepts({ cases: [{ ...QUEUE_ROW, routed: false }] })).toBe(true);
    expect(accepts({ cases: [{ ...QUEUE_ROW, routed: undefined }] })).toBe(false);
    expect(accepts({ cases: [{ ...QUEUE_ROW, routed: 'no' }] })).toBe(false);
  });

  it('rejects newest first', () => {
    expect(accepts({ cases: [{ ...QUEUE_ROW, createdAt: LATE }, QUEUE_ROW] })).toBe(false);
  });

  it.each(['studentNote', 'note', 'ownerUserId', 'studentName', 'tenantId'])(
    'rejects %s so the queue carries no note or identity',
    (field) => {
      expect(accepts({ cases: [{ ...QUEUE_ROW, [field]: 'x' }] })).toBe(false);
    },
  );
});
