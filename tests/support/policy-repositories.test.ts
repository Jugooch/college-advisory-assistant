/**
 * @file Proves the QA policy repository fake follows the `@caa/db` contract: tenant filter,
 * approved only, start inclusive and end exclusive, highest revision chosen before the audience
 * filter, ordering by key, and a refusal of an invalid instant.
 * @requirement FR-16
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import { PolicyApprovalStatus, PolicyAudience } from '@caa/domain';
import { buildPolicyDocument, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { createPolicyRepositories, type PolicyDocumentWorld } from './policy-repositories';

const TENANT_A = SYNTHETIC_TENANTS.a.id;
const TENANT_B = SYNTHETIC_TENANTS.b.id;
const AS_OF = '2026-09-22T12:00:00.000-05:00';
const BOTH = [PolicyAudience.Student, PolicyAudience.All];

/**
 * Lists the applicable revisions as `key@revision` strings.
 *
 * @param world - Backing data.
 * @param audiences - Audiences the caller may read.
 * @param asOf - Instant to evaluate at.
 * @returns The `key@revision` strings, in the repository's order.
 */
async function list(
  world: PolicyDocumentWorld,
  audiences: readonly PolicyAudience[] = BOTH,
  asOf = AS_OF,
): Promise<string[]> {
  const found = await createPolicyRepositories(world).policyDocuments.listApplicable({
    tenantId: TENANT_A,
    audiences,
    asOf,
  });
  return found.map((doc) => `${doc.documentKey}@${String(doc.revision)}`);
}

describe('policy repository fake', () => {
  it('lists approved documents of the tenant ordered by key', async () => {
    const world = {
      policyDocuments: [
        buildPolicyDocument({ documentKey: 'withdrawal', subjectKey: 'withdrawal' }, 1),
        buildPolicyDocument({ documentKey: 'add-drop', subjectKey: 'add-drop' }, 2),
        buildPolicyDocument({ tenantId: TENANT_B }, 3),
      ],
    };
    expect(await list(world)).toEqual(['add-drop@1', 'withdrawal@1']);
  });

  it('never returns a draft or withdrawn revision', async () => {
    const world = {
      policyDocuments: [
        buildPolicyDocument({ approvalStatus: PolicyApprovalStatus.Draft, approvedAt: null }, 1),
        buildPolicyDocument(
          {
            documentKey: 'other',
            approvalStatus: PolicyApprovalStatus.Withdrawn,
            approvedAt: null,
          },
          2,
        ),
      ],
    };
    expect(await list(world)).toEqual([]);
  });

  it('includes the start instant and excludes the end instant', async () => {
    const world = {
      policyDocuments: [
        buildPolicyDocument({ effectiveFrom: AS_OF, effectiveTo: '2026-10-01T00:00:00.000-05:00' }),
      ],
    };
    expect(await list(world, BOTH, AS_OF)).toEqual(['late-registration@1']);
    expect(await list(world, BOTH, '2026-10-01T00:00:00.000-05:00')).toEqual([]);
    expect(await list(world, BOTH, '2026-09-22T11:59:59.999-05:00')).toEqual([]);
  });

  it('chooses the highest revision first and then applies the audience', async () => {
    const world = {
      policyDocuments: [
        buildPolicyDocument({ revision: 1, audience: PolicyAudience.All }, 1),
        buildPolicyDocument({ revision: 2, audience: PolicyAudience.Advisor }, 2),
      ],
    };
    expect(await list(world, BOTH)).toEqual([]);
    expect(await list(world, [PolicyAudience.Advisor])).toEqual(['late-registration@2']);
  });

  it('falls back to an older revision when the newer one is not yet in force', async () => {
    const world = {
      policyDocuments: [
        buildPolicyDocument({ revision: 1, effectiveTo: '2026-10-01T00:00:00.000-05:00' }, 1),
        buildPolicyDocument({ revision: 2, effectiveFrom: '2026-10-01T00:00:00.000-05:00' }, 2),
      ],
    };
    expect(await list(world)).toEqual(['late-registration@1']);
    expect(await list(world, BOTH, '2026-10-01T00:00:00.000-05:00')).toEqual([
      'late-registration@2',
    ]);
  });

  it('returns nothing without audiences and reads changed data', async () => {
    const world: PolicyDocumentWorld = { policyDocuments: [buildPolicyDocument()] };
    expect(await list(world, [])).toEqual([]);
    world.policyDocuments = [];
    expect(await list(world)).toEqual([]);
  });

  it('refuses an invalid instant', async () => {
    await expect(list({}, BOTH, 'not-a-date')).rejects.toThrow(RangeError);
  });
});
