/**
 * @file Tests for the plannable-terms contract.
 */
import { describe, expect, it } from 'vitest';

import { createApiClient } from '../client/create-api-client';
import {
  getPlannableTermsEndpoint,
  PlannableTermsResponseSchema,
} from './plannable-terms.contract';

const FALL = {
  id: '3c4d5e6f-0000-4000-8000-000000000001',
  termCode: '2026FA',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
};
const SPRING = {
  id: '3c4d5e6f-0000-4000-8000-000000000002',
  termCode: '2027SP',
  startsOn: '2027-01-11',
  endsOn: '2027-05-07',
};

describe('getPlannableTermsEndpoint', () => {
  it('declares GET /v1/students/:studentId/plannable-terms with no body or query', () => {
    expect(getPlannableTermsEndpoint).toMatchObject({
      method: 'GET',
      path: '/v1/students/:studentId/plannable-terms',
    });
    expect(getPlannableTermsEndpoint).not.toHaveProperty('request');
    expect(getPlannableTermsEndpoint).not.toHaveProperty('query');
  });

  it('is callable through the generic typed client', async () => {
    const fetchImpl = (): Promise<Response> =>
      Promise.resolve(Response.json({ data: { terms: [FALL] } }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn: fetchImpl });

    const result = await client.call(getPlannableTermsEndpoint, {
      params: { studentId: 'S-1' },
    });

    expect(result).toEqual({ terms: [FALL] });
  });
});

describe('PlannableTermsResponseSchema', () => {
  it('accepts an empty list (the advisor referral case)', () => {
    expect(PlannableTermsResponseSchema.parse({ terms: [] })).toEqual({ terms: [] });
  });

  it('keeps the server order', () => {
    const parsed = PlannableTermsResponseSchema.parse({ terms: [SPRING, FALL] });

    expect(parsed.terms.map((term) => term.termCode)).toEqual(['2027SP', '2026FA']);
  });

  it('rejects a repeated term id', () => {
    const result = PlannableTermsResponseSchema.safeParse({
      terms: [FALL, { ...SPRING, id: FALL.id }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a repeated term code', () => {
    const result = PlannableTermsResponseSchema.safeParse({
      terms: [FALL, { ...SPRING, termCode: FALL.termCode }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a term that ends before it starts', () => {
    const result = PlannableTermsResponseSchema.safeParse({
      terms: [{ ...FALL, startsOn: '2026-12-12' }],
    });

    expect(result.success).toBe(false);
  });

  it('strips tenantId and sequence', () => {
    const parsed = PlannableTermsResponseSchema.parse({
      terms: [{ ...FALL, tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f', sequence: 1 }],
    });

    expect(parsed.terms[0]).toEqual(FALL);
  });
});
