/**
 * @file Tests for the synthetic policy hit builder.
 */
import { describe, expect, it } from 'vitest';

import { PolicyHitSchema } from '@caa/api-contract';

import { buildPolicyHit } from './policy-hit.builder';

describe('buildPolicyHit', () => {
  it('defaults to the late-registration hit, open ended, with no conflict', () => {
    const hit = buildPolicyHit();

    expect(PolicyHitSchema.safeParse(hit).success).toBe(true);
    expect(hit).toEqual({
      documentKey: 'late-registration',
      revision: 1,
      title: 'Late registration',
      excerpt: 'A student who registers after the posted date asks the registrar for a late form.',
      topic: 'GENERAL',
      effectiveFrom: '2026-08-01T00:00:00.000-05:00',
      effectiveTo: null,
      sourceLabel: 'Demo State University Registrar Handbook',
      approvedAt: '2026-07-15T09:00:00.000-05:00',
      conflict: false,
    });
  });

  it('lets an override win', () => {
    expect(buildPolicyHit({ conflict: true }).conflict).toBe(true);
  });

  it('rejects a reversed interval', () => {
    expect(() => buildPolicyHit({ effectiveTo: '2026-07-01T00:00:00.000-05:00' })).toThrow();
  });
});
