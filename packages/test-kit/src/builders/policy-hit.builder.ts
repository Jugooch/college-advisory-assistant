/**
 * @file Builds synthetic policy search hits in the #500 contract shape.
 * @module @caa/test-kit/builders/policy-hit
 */
import type { z } from 'zod';

import { type PolicyHit, PolicyHitSchema } from '@caa/api-contract';
import { PolicyTopic } from '@caa/domain';

/** Raw input accepted for a policy hit, as the contract schema reads it. */
export type PolicyHitInput = z.input<typeof PolicyHitSchema>;

/**
 * Builds a valid hit for the default policy document (`late-registration`, revision 1), open
 * ended, approved 2026-07-15, with `conflict` false.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated policy hit.
 */
export function buildPolicyHit(overrides: Partial<PolicyHitInput> = {}): PolicyHit {
  return PolicyHitSchema.parse({
    documentKey: 'late-registration',
    revision: 1,
    title: 'Late registration',
    excerpt: 'A student who registers after the posted date asks the registrar for a late form.',
    topic: PolicyTopic.General,
    effectiveFrom: '2026-08-01T00:00:00.000-05:00',
    effectiveTo: null,
    sourceLabel: 'Demo State University Registrar Handbook',
    approvedAt: '2026-07-15T09:00:00.000-05:00',
    conflict: false,
    ...overrides,
  });
}
