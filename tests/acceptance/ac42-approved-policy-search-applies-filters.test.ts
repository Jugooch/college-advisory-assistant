/**
 * @file Acceptance AC42 (planning/13): approved policy search applies tenant, audience and
 * effective-date filters. Runs `GET /v1/policies` through the API harness at the fixed instant
 * 2026-09-01T12:00:00.000Z. Expected keys and revisions are written out literally from the
 * planning/13 row and ADR-0015 section 6, never computed by the search logic.
 * @requirement FR-08
 * @requirement FR-16
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { PolicyApprovalStatus, PolicyAudience } from '@caa/domain';
import { buildPolicyDocument, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { type AcceptanceResponse, getAs } from '../support/api-harness';

/** A word only the test corpus uses, so every query matches the documents by body text. */
const KEYWORD = 'quokka';
/** The harness clock. */
const NOW = '2026-09-01T12:00:00.000Z';

const world = createAcademicWorld();
const app = buildAcademicApp(world);

/**
 * Searches as an actor.
 *
 * @param actor - Which signed-in actor searches.
 * @returns The response.
 */
function search(actor: 'student' | 'advisor' | 'tenantBAdmin'): Promise<AcceptanceResponse> {
  return getAs(app, `/v1/policies?q=${KEYWORD}`, `Bearer academic-${actor}`);
}

/** The fields of a search response the cases read. */
interface SearchData {
  readonly asOf: string;
  readonly hits: readonly { readonly documentKey: string; readonly revision: number }[];
}

/**
 * Reads `data` from a 200 search response, checking the fields the cases read.
 *
 * @param response - A response.
 * @returns The search data.
 */
function dataOf(response: AcceptanceResponse): SearchData {
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({
    data: {
      asOf: expect.any(String) as string,
      hits: expect.any(Array) as unknown[],
    },
  });
  return (response.body as { data: SearchData }).data;
}

/**
 * Reads `key@revision` for each hit, sorted, so a case states the whole result literally.
 *
 * @param response - A 200 response.
 * @returns The sorted `documentKey@revision` strings.
 */
function hitsOf(response: AcceptanceResponse): string[] {
  return dataOf(response)
    .hits.map((hit) => `${hit.documentKey}@${String(hit.revision)}`)
    .sort();
}

const body = `The ${KEYWORD} rule applies.`;

beforeEach(() => {
  world.policyDocuments = [];
});

describe('AC42 approved policy search applies tenant, audience and effective-date filters', () => {
  it('judges the search at the clock instant', async () => {
    world.policyDocuments = [buildPolicyDocument({ body }, 1)];
    expect(dataOf(await search('student')).asOf).toBe(NOW);
  });

  it("never returns another tenant's document, even an approved, current one", async () => {
    world.policyDocuments = [
      buildPolicyDocument({ documentKey: 'a-doc', subjectKey: 'a', body }, 1),
      buildPolicyDocument(
        { documentKey: 'b-doc', subjectKey: 'b', body, tenantId: SYNTHETIC_TENANTS.b.id },
        2,
      ),
    ];

    expect(hitsOf(await search('student'))).toEqual(['a-doc@1']);
    expect(hitsOf(await search('tenantBAdmin'))).toEqual(['b-doc@1']);
  });

  it('keeps advisor-only documents from a student but shows them to an advisor', async () => {
    world.policyDocuments = [
      buildPolicyDocument({ documentKey: 'for-students', subjectKey: 'a', body }, 1),
      buildPolicyDocument(
        { documentKey: 'for-all', subjectKey: 'b', body, audience: PolicyAudience.All },
        2,
      ),
      buildPolicyDocument(
        { documentKey: 'for-advisors', subjectKey: 'c', body, audience: PolicyAudience.Advisor },
        3,
      ),
    ];

    expect(hitsOf(await search('student'))).toEqual(['for-all@1', 'for-students@1']);
    expect(hitsOf(await search('advisor'))).toEqual([
      'for-advisors@1',
      'for-all@1',
      'for-students@1',
    ]);
  });

  it('excludes expired and future revisions, includes effectiveFrom == now, excludes effectiveTo == now', async () => {
    world.policyDocuments = [
      buildPolicyDocument(
        { documentKey: 'expired', subjectKey: 'a', body, effectiveTo: '2026-08-31T12:00:00.000Z' },
        1,
      ),
      buildPolicyDocument(
        { documentKey: 'future', subjectKey: 'b', body, effectiveFrom: '2026-09-02T00:00:00.000Z' },
        2,
      ),
      buildPolicyDocument(
        { documentKey: 'ends-at-now', subjectKey: 'c', body, effectiveTo: NOW },
        3,
      ),
      buildPolicyDocument(
        {
          documentKey: 'ends-after-now',
          subjectKey: 'd',
          body,
          effectiveTo: '2026-09-01T12:00:00.001Z',
        },
        4,
      ),
      buildPolicyDocument(
        { documentKey: 'starts-at-now', subjectKey: 'e', body, effectiveFrom: NOW },
        5,
      ),
    ];

    expect(hitsOf(await search('student'))).toEqual(['ends-after-now@1', 'starts-at-now@1']);
  });

  it('compares effective dates as instants across UTC offsets', async () => {
    world.policyDocuments = [
      // 07:00-05:00 is 12:00Z, exactly now, so the revision has just ended.
      buildPolicyDocument(
        {
          documentKey: 'ends-at-now',
          subjectKey: 'a',
          body,
          effectiveTo: '2026-09-01T07:00:00.000-05:00',
        },
        1,
      ),
      // 08:00-05:00 is 13:00Z, an hour from now.
      buildPolicyDocument(
        {
          documentKey: 'ends-later',
          subjectKey: 'b',
          body,
          effectiveTo: '2026-09-01T08:00:00.000-05:00',
        },
        2,
      ),
    ];

    expect(hitsOf(await search('student'))).toEqual(['ends-later@1']);
  });

  it('excludes draft and withdrawn revisions', async () => {
    world.policyDocuments = [
      buildPolicyDocument({ documentKey: 'approved', subjectKey: 'a', body }, 1),
      buildPolicyDocument(
        {
          documentKey: 'draft',
          subjectKey: 'b',
          body,
          approvalStatus: PolicyApprovalStatus.Draft,
          approvedAt: null,
        },
        2,
      ),
      buildPolicyDocument(
        {
          documentKey: 'withdrawn',
          subjectKey: 'c',
          body,
          approvalStatus: PolicyApprovalStatus.Withdrawn,
          approvedAt: null,
        },
        3,
      ),
    ];

    expect(hitsOf(await search('student'))).toEqual(['approved@1']);
  });

  it('returns one revision per document key, the highest in force', async () => {
    world.policyDocuments = [
      buildPolicyDocument({ documentKey: 'late-registration', revision: 1, body }, 1),
      buildPolicyDocument({ documentKey: 'late-registration', revision: 2, body }, 2),
      // Revision 3 is approved but starts tomorrow, so revision 2 is the one in force.
      buildPolicyDocument(
        {
          documentKey: 'late-registration',
          revision: 3,
          body,
          effectiveFrom: '2026-09-02T00:00:00.000Z',
        },
        3,
      ),
      // Revision 4 is still a draft.
      buildPolicyDocument(
        {
          documentKey: 'late-registration',
          revision: 4,
          body,
          approvalStatus: PolicyApprovalStatus.Draft,
          approvedAt: null,
        },
        4,
      ),
    ];

    expect(hitsOf(await search('student'))).toEqual(['late-registration@2']);
  });

  it('never gives a student the older student revision when a newer revision is advisor-only', async () => {
    world.policyDocuments = [
      buildPolicyDocument({ documentKey: 'override-rules', subjectKey: 'a', revision: 1, body }, 1),
      buildPolicyDocument(
        {
          documentKey: 'override-rules',
          subjectKey: 'a',
          revision: 2,
          body,
          audience: PolicyAudience.Advisor,
        },
        2,
      ),
    ];

    expect(hitsOf(await search('student'))).toEqual([]);
    expect(hitsOf(await search('advisor'))).toEqual(['override-rules@2']);
  });

  it('gives identical results for identical queries', async () => {
    world.policyDocuments = [
      buildPolicyDocument({ documentKey: 'one', subjectKey: 'a', body }, 1),
      buildPolicyDocument({ documentKey: 'two', subjectKey: 'b', body }, 2),
    ];
    const first = await search('student');
    const second = await search('student');

    expect(second.body).toEqual(first.body);
  });

  it.todo('shows a conflict notice on both documents of a disagreeing pair (#517)');
  it.todo(
    'shows injected policy text as quoted policy and changes no tool call, block or access decision (#517)',
  );
});
