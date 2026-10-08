/**
 * @file Tests for the synthetic policy document builder.
 */
import { describe, expect, it } from 'vitest';

import { PolicyDocumentSchema } from '@caa/domain';

import { buildPolicyDocument, syntheticContentHash } from './policy-document.builder';

describe('buildPolicyDocument', () => {
  it('defaults to a current approved student document in tenant A', () => {
    const document = buildPolicyDocument();

    expect(PolicyDocumentSchema.safeParse(document).success).toBe(true);
    expect(document).toEqual({
      id: '11000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      documentKey: 'late-registration',
      revision: 1,
      title: 'Late registration',
      body: 'A student who registers after the posted date asks the registrar for a late registration form. The registrar reviews each request.',
      topic: 'GENERAL',
      subjectKey: 'late-registration',
      audience: 'STUDENT',
      effectiveFrom: '2026-08-01T00:00:00.000-05:00',
      effectiveTo: null,
      approvalStatus: 'APPROVED',
      approvedAt: '2026-07-15T09:00:00.000-05:00',
      sourceLabel: 'Demo State University Registrar Handbook',
      contentHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
    });
  });

  it('derives the id and content hash from the seed', () => {
    const document = buildPolicyDocument({}, 255);

    expect(document.id).toBe('11000000-0000-4000-8000-0000000000ff');
    expect(document.contentHash).toBe(syntheticContentHash(255));
  });

  it('lets an override win', () => {
    expect(buildPolicyDocument({ audience: 'ADVISOR' }).audience).toBe('ADVISOR');
  });

  it('rejects an approved document with no approval time', () => {
    expect(() => buildPolicyDocument({ approvedAt: null })).toThrow();
  });
});
