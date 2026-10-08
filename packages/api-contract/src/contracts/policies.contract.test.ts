/**
 * @file Tests for the approved policy search contract.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApiClient } from '../client/create-api-client';
import {
  PolicyHitSchema,
  PolicySearchQuerySchema,
  PolicySearchResponseSchema,
  searchPoliciesEndpoint,
} from './policies.contract';

const HIT = {
  documentKey: 'withdrawal-deadline',
  revision: 2,
  title: 'Withdrawal deadline',
  excerpt: 'Students may withdraw before the ninth week.',
  topic: 'GENERAL',
  effectiveFrom: '2026-08-01T00:00:00-05:00',
  effectiveTo: null,
  sourceLabel: 'Synthetic Registrar Handbook',
  approvedAt: '2026-07-15T12:00:00-05:00',
  conflict: false,
};
const AS_OF = '2026-10-08T09:00:00-05:00';

describe('searchPoliciesEndpoint', () => {
  it('declares GET /v1/policies with a query and no body', () => {
    expect(searchPoliciesEndpoint).toMatchObject({ method: 'GET', path: '/v1/policies' });
    expect(searchPoliciesEndpoint).not.toHaveProperty('request');
  });

  it('is callable through the generic typed client with a query', async () => {
    let requested = '';
    const fetchImpl = (input: string | URL | Request): Promise<Response> => {
      requested = input instanceof Request ? input.url : input.toString();
      return Promise.resolve(Response.json({ data: { hits: [HIT], asOf: AS_OF } }));
    };
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn: fetchImpl });

    const result = await client.call(searchPoliciesEndpoint, { query: { q: 'withdraw' } });

    expect(result.hits).toHaveLength(1);
    expect(requested).toContain('/v1/policies?q=withdraw');
  });

  it('refuses a query with neither q nor topic before sending a request', async () => {
    let calls = 0;
    const fetchImpl = (): Promise<Response> => {
      calls += 1;
      return Promise.reject(new Error('must not be called'));
    };
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn: fetchImpl });

    await expect(client.call(searchPoliciesEndpoint, { query: {} })).rejects.toBeInstanceOf(
      z.ZodError,
    );
    expect(calls).toBe(0);
  });
});

describe('PolicySearchQuerySchema', () => {
  it('accepts q alone, topic alone, or both', () => {
    expect(PolicySearchQuerySchema.safeParse({ q: 'drop' }).success).toBe(true);
    expect(PolicySearchQuerySchema.safeParse({ topic: 'FINANCIAL_AID' }).success).toBe(true);
    expect(PolicySearchQuerySchema.safeParse({ q: 'drop', topic: 'GENERAL' }).success).toBe(true);
  });

  it('rejects an empty query object', () => {
    expect(PolicySearchQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects an empty, blank or over-long q', () => {
    expect(PolicySearchQuerySchema.safeParse({ q: '' }).success).toBe(false);
    expect(PolicySearchQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
    expect(PolicySearchQuerySchema.safeParse({ q: 'a'.repeat(201) }).success).toBe(false);
    expect(PolicySearchQuerySchema.safeParse({ q: 'a'.repeat(200) }).success).toBe(true);
  });

  it('rejects an unknown topic', () => {
    expect(PolicySearchQuerySchema.safeParse({ topic: 'PARKING' }).success).toBe(false);
  });

  it.each(['tenantId', 'userId', 'role', 'audience'])('rejects the identity key %s', (key) => {
    expect(PolicySearchQuerySchema.safeParse({ q: 'drop', [key]: 'x' }).success).toBe(false);
  });
});

describe('PolicyHitSchema', () => {
  it('accepts a hit with an open or closed interval', () => {
    expect(PolicyHitSchema.safeParse(HIT).success).toBe(true);
    const closed = { ...HIT, effectiveTo: '2027-08-01T00:00:00-05:00' };
    expect(PolicyHitSchema.safeParse(closed).success).toBe(true);
  });

  it('rejects an excerpt over 500 characters', () => {
    const long = { ...HIT, excerpt: 'a'.repeat(501) };
    expect(PolicyHitSchema.safeParse(long).success).toBe(false);
    expect(PolicyHitSchema.safeParse({ ...HIT, excerpt: 'a'.repeat(500) }).success).toBe(true);
  });

  it('rejects a missing approval time (unapproved text is never a hit)', () => {
    expect(PolicyHitSchema.safeParse({ ...HIT, approvedAt: null }).success).toBe(false);
  });

  it('compares interval ends as instants across offsets', () => {
    const laterInstantEarlierText = {
      ...HIT,
      effectiveFrom: '2026-08-01T00:00:00+00:00',
      effectiveTo: '2026-07-31T20:00:00-05:00',
    };
    expect(PolicyHitSchema.safeParse(laterInstantEarlierText).success).toBe(true);
    const wrong = { ...HIT, effectiveTo: '2026-07-31T23:00:00+00:00' };
    expect(PolicyHitSchema.safeParse(wrong).success).toBe(false);
  });

  it.each(['body', 'tenantId', 'subjectKey', 'audience', 'contentHash'])(
    'rejects the server-only field %s',
    (key) => {
      expect(PolicyHitSchema.safeParse({ ...HIT, [key]: 'x' }).success).toBe(false);
    },
  );

  it('rejects a hit missing the conflict flag', () => {
    const rest: Record<string, unknown> = { ...HIT };
    delete rest.conflict;
    expect(PolicyHitSchema.safeParse(rest).success).toBe(false);
  });
});

describe('PolicySearchResponseSchema', () => {
  it('accepts no hits (nothing approved matched)', () => {
    expect(PolicySearchResponseSchema.safeParse({ hits: [], asOf: AS_OF }).success).toBe(true);
  });

  it('accepts up to three hits and rejects four', () => {
    const hit = (key: string): typeof HIT => ({ ...HIT, documentKey: key });
    const three = [hit('a'), hit('b'), hit('c')];
    expect(PolicySearchResponseSchema.safeParse({ hits: three, asOf: AS_OF }).success).toBe(true);
    const four = [...three, hit('d')];
    expect(PolicySearchResponseSchema.safeParse({ hits: four, asOf: AS_OF }).success).toBe(false);
  });

  it('rejects two revisions of the same document', () => {
    const hits = [HIT, { ...HIT, revision: 1 }];
    expect(PolicySearchResponseSchema.safeParse({ hits, asOf: AS_OF }).success).toBe(false);
  });

  describe('applicability at asOf', () => {
    const parse = (hit: object): boolean =>
      PolicySearchResponseSchema.safeParse({ hits: [{ ...HIT, ...hit }], asOf: AS_OF }).success;

    it('rejects an expired hit', () => {
      expect(parse({ effectiveTo: '2026-01-01T00:00:00Z' })).toBe(false);
    });

    it('rejects a hit that is not yet effective', () => {
      expect(parse({ effectiveFrom: '2027-01-01T00:00:00Z' })).toBe(false);
    });

    it('rejects a hit whose effectiveTo equals asOf (end is exclusive)', () => {
      expect(parse({ effectiveTo: '2026-10-08T14:00:00Z' })).toBe(false);
    });

    it('accepts a hit whose effectiveFrom equals asOf, and an open-ended hit', () => {
      expect(parse({ effectiveFrom: '2026-10-08T14:00:00Z' })).toBe(true);
      expect(parse({ effectiveTo: null })).toBe(true);
    });
  });

  it('requires asOf as an instant with an offset', () => {
    expect(PolicySearchResponseSchema.safeParse({ hits: [] }).success).toBe(false);
    expect(
      PolicySearchResponseSchema.safeParse({ hits: [], asOf: '2026-10-08T09:00:00' }).success,
    ).toBe(false);
  });

  it('rejects extra keys', () => {
    const body = { hits: [], asOf: AS_OF, tenantId: 'x' };
    expect(PolicySearchResponseSchema.safeParse(body).success).toBe(false);
  });
});
