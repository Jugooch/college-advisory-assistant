/**
 * @file Builds synthetic approved policy documents for tests. All text is fictional.
 * @module @caa/test-kit/builders/policy-document
 */
import {
  createPolicyDocument,
  PolicyApprovalStatus,
  PolicyAudience,
  type PolicyDocument,
  type PolicyDocumentInput,
  PolicyTopic,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Derives a clearly synthetic content hash, `sha256:` plus the seed in hex padded to 64 digits.
 *
 * @param seed - Non-negative integer that distinguishes documents.
 * @returns A string that satisfies the content hash format.
 */
export function syntheticContentHash(seed: number): string {
  return `sha256:${seed.toString(16).padStart(64, '0')}`;
}

/**
 * Builds a valid, currently applicable, approved `STUDENT` policy document in tenant A.
 *
 * Defaults: document key `late-registration`, revision 1, topic `GENERAL`, effective from
 * 2026-08-01 with no end, approved 2026-07-15. The `id` and `contentHash` derive from the seed.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes documents; drives the default `id` and `contentHash`.
 * @returns A validated policy document.
 */
export function buildPolicyDocument(
  overrides: Partial<PolicyDocumentInput> = {},
  seed = 1,
): PolicyDocument {
  return createPolicyDocument({
    id: syntheticId('policyDocument', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    documentKey: 'late-registration',
    revision: 1,
    title: 'Late registration',
    body: 'A student who registers after the posted date asks the registrar for a late registration form. The registrar reviews each request.',
    topic: PolicyTopic.General,
    subjectKey: 'late-registration',
    audience: PolicyAudience.Student,
    effectiveFrom: '2026-08-01T00:00:00.000-05:00',
    effectiveTo: null,
    approvalStatus: PolicyApprovalStatus.Approved,
    approvedAt: '2026-07-15T09:00:00.000-05:00',
    sourceLabel: 'Demo State University Registrar Handbook',
    contentHash: syntheticContentHash(seed),
    ...overrides,
  });
}
