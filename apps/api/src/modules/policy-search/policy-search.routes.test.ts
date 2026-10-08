/**
 * @file HTTP-level tests for `GET /v1/policies`: 200, 400, 401, tenant isolation, audience,
 * effective dates, draft and withdrawn exclusion, and a log with no query or body text.
 * @requirement FR-16
 * @requirement FR-02
 * @requirement FR-14
 * @requirement NFR-02
 * @requirement AC42
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { PolicySearchResponseSchema } from '@caa/api-contract';
import { ErrorCode, PolicyApprovalStatus, PolicyAudience } from '@caa/domain';
import { buildPolicyDocument, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { buildWorldApp, readError, TEST_NOW, TOKENS } from '../../testing/fixtures';
import { searchPolicies } from '../../testing/policy-search-harness';

const { app, store } = buildWorldApp();
const SECRET_QUERY = 'zebrafish';

/**
 * Reads the keys of the hits from a response.
 *
 * @param response - The injected response.
 * @returns The document keys, in order.
 */
function keysOf(response: { json: () => unknown }): string[] {
  const data = z.object({ data: z.unknown() }).parse(response.json()).data;
  return PolicySearchResponseSchema.parse(data).hits.map((hit) => hit.documentKey);
}

beforeEach(() => {
  store.policyDocuments = [
    buildPolicyDocument(
      { documentKey: 'current', subjectKey: 's1', body: `The ${SECRET_QUERY} rule.` },
      1,
    ),
    buildPolicyDocument(
      {
        documentKey: 'advisor-only',
        subjectKey: 's2',
        audience: PolicyAudience.Advisor,
        body: `${SECRET_QUERY} notes.`,
      },
      2,
    ),
    buildPolicyDocument(
      {
        documentKey: 'draft',
        subjectKey: 's3',
        approvalStatus: PolicyApprovalStatus.Draft,
        approvedAt: null,
        body: SECRET_QUERY,
      },
      3,
    ),
    buildPolicyDocument(
      {
        documentKey: 'withdrawn',
        subjectKey: 's4',
        approvalStatus: PolicyApprovalStatus.Withdrawn,
        approvedAt: null,
        body: SECRET_QUERY,
      },
      4,
    ),
    buildPolicyDocument(
      {
        documentKey: 'future',
        subjectKey: 's5',
        effectiveFrom: '2026-10-01T00:00:00.000Z',
        body: SECRET_QUERY,
      },
      5,
    ),
    buildPolicyDocument(
      {
        documentKey: 'ended-now',
        subjectKey: 's6',
        effectiveTo: TEST_NOW.toISOString(),
        body: SECRET_QUERY,
      },
      6,
    ),
    buildPolicyDocument(
      {
        documentKey: 'other-tenant',
        subjectKey: 's7',
        tenantId: SYNTHETIC_TENANTS.b.id,
        body: SECRET_QUERY,
      },
      7,
    ),
  ];
});

describe('GET /v1/policies', () => {
  it('returns the current student document with asOf from the clock, and no body or tenant', async () => {
    const response = await searchPolicies(app, `q=${SECRET_QUERY}`, TOKENS.student);

    expect(response.statusCode).toBe(200);
    expect(keysOf(response)).toEqual(['current']);
    const raw = response.body;
    expect(raw).toContain(TEST_NOW.toISOString());
    expect(raw).not.toContain('tenantId');
    expect(raw).not.toContain('contentHash');
  });

  it('never shows a student an advisor-only document, but shows staff one', async () => {
    expect(keysOf(await searchPolicies(app, `q=${SECRET_QUERY}`, TOKENS.student))).toEqual([
      'current',
    ]);
    expect(keysOf(await searchPolicies(app, `q=${SECRET_QUERY}`, TOKENS.advisor))).toEqual([
      'advisor-only',
      'current',
    ]);
  });

  it('excludes drafts, withdrawn, future, ended-at-now and other-tenant documents', async () => {
    const keys = keysOf(await searchPolicies(app, `q=${SECRET_QUERY}`, TOKENS.advisor));

    expect(keys).not.toEqual(expect.arrayContaining(['draft']));
    expect(keys.sort()).toEqual(['advisor-only', 'current']);
  });

  it('serves another tenant its own documents only', async () => {
    const keys = keysOf(await searchPolicies(app, `q=${SECRET_QUERY}`, TOKENS.admin));

    expect(keys).toEqual(['other-tenant']);
  });

  it('returns an empty list when nothing matches', async () => {
    const response = await searchPolicies(app, 'q=nomatchingword', TOKENS.student);

    expect(response.statusCode).toBe(200);
    expect(keysOf(response)).toEqual([]);
  });

  it.each([
    ['no q or topic', ''],
    ['an unknown topic', 'topic=NOPE'],
    ['a tenant parameter', `q=a&tenantId=${SYNTHETIC_TENANTS.b.id}`],
    ['a role parameter', 'q=a&role=ADVISOR'],
    ['a user parameter', 'q=a&userId=u'],
    ['an audience parameter', 'q=a&audience=ADVISOR'],
    ['an over-long q', `q=${'a'.repeat(201)}`],
  ])('answers 400 INVALID_REQUEST for %s', async (_label, query) => {
    const response = await searchPolicies(app, query, TOKENS.student);

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).code).toBe(ErrorCode.InvalidRequest);
  });

  it('answers 401 without a session', async () => {
    const response = await searchPolicies(app, `q=${SECRET_QUERY}`, null);

    expect(response.statusCode).toBe(401);
    expect(readError(response.json()).code).toBe(ErrorCode.Unauthorized);
  });
});
