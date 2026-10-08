/**
 * @file Tests for the policy document data object and its enums.
 */
import { describe, expect, it } from 'vitest';

import { PolicyTopic } from '../enums/policy-topic.enum';
import { SpecialistTopic } from '../enums/specialist-topic.enum';
import { createPolicyDocument, type PolicyDocumentInput } from './policy-document.model';

const VALID: PolicyDocumentInput = {
  id: '3c4d5e6f-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  documentKey: 'add-drop-deadlines',
  revision: 1,
  title: 'Adding and dropping courses',
  body: 'A fictional policy about adding and dropping courses.',
  topic: 'GENERAL',
  subjectKey: 'add-drop',
  audience: 'ALL',
  effectiveFrom: '2026-08-01T00:00:00.000-05:00',
  effectiveTo: null,
  approvalStatus: 'APPROVED',
  approvedAt: '2026-07-20T12:00:00.000-05:00',
  sourceLabel: 'Fictional Registrar Handbook',
  contentHash: `sha256:${'a'.repeat(64)}`,
};

describe('createPolicyDocument', () => {
  it('accepts a valid approved document', () => {
    expect(createPolicyDocument(VALID)).toEqual(VALID);
  });

  it('accepts a bounded interval', () => {
    const doc = createPolicyDocument({ ...VALID, effectiveTo: '2026-12-20T00:00:00.000-06:00' });
    expect(doc.effectiveTo).toBe('2026-12-20T00:00:00.000-06:00');
  });

  it.each(['2026-08-01T00:00:00.000-05:00', '2026-07-01T00:00:00.000-05:00'])(
    'rejects effectiveTo %s that is not after effectiveFrom',
    (effectiveTo) => {
      expect(() => createPolicyDocument({ ...VALID, effectiveTo })).toThrow();
    },
  );

  it('compares the interval as instants across offsets', () => {
    expect(() =>
      createPolicyDocument({ ...VALID, effectiveTo: '2026-08-01T05:00:00.000Z' }),
    ).toThrow();
  });

  it('rejects an approved document without approvedAt', () => {
    expect(() => createPolicyDocument({ ...VALID, approvedAt: null })).toThrow();
  });

  it.each(['DRAFT', 'WITHDRAWN'] as const)('rejects a %s document with approvedAt', (status) => {
    expect(() => createPolicyDocument({ ...VALID, approvalStatus: status })).toThrow();
  });

  it('accepts a draft without approvedAt', () => {
    expect(
      createPolicyDocument({ ...VALID, approvalStatus: 'DRAFT', approvedAt: null }).approvedAt,
    ).toBeNull();
  });

  it.each([
    ['empty body', { body: '' }],
    ['oversized body', { body: 'x'.repeat(20001) }],
    ['empty title', { title: '' }],
    ['oversized title', { title: 'x'.repeat(201) }],
    ['revision zero', { revision: 0 }],
    ['unknown topic', { topic: 'TUITION' }],
    ['bad hash', { contentHash: 'abc' }],
  ])('rejects %s', (_name, patch) => {
    expect(() => createPolicyDocument({ ...VALID, ...patch } as PolicyDocumentInput)).toThrow();
  });

  it('accepts a body of exactly 20,000 characters', () => {
    expect(createPolicyDocument({ ...VALID, body: 'x'.repeat(20000) }).body).toHaveLength(20000);
  });
});

describe('PolicyTopic', () => {
  it('is GENERAL plus every specialist topic', () => {
    expect(Object.values(PolicyTopic).sort()).toEqual(
      ['GENERAL', ...Object.values(SpecialistTopic)].sort(),
    );
  });
});
