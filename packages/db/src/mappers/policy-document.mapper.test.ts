/**
 * @file Tests for the policy document row mapper.
 */
import { describe, expect, it } from 'vitest';

import type { PolicyDocumentRow } from '../tables/policy-document.table';
import { toPolicyDocument } from './policy-document.mapper';

const ROW: PolicyDocumentRow = {
  id: '9f4e5d6c-7b8a-4f9e-a0d1-3c4d5e6f7081',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  documentKey: 'add-drop-deadlines',
  revision: 2,
  title: 'Adding and dropping courses',
  body: 'Fictional approved text.',
  topic: 'GENERAL',
  subjectKey: 'add-drop',
  audience: 'STUDENT',
  effectiveFrom: new Date('2026-08-01T05:00:00.000Z'),
  effectiveTo: new Date('2026-12-20T06:00:00.000Z'),
  approvalStatus: 'APPROVED',
  approvedAt: new Date('2026-07-15T12:00:00.000Z'),
  withdrawnAt: null,
  sourceLabel: 'Fictional handbook',
  contentHash: `sha256:${'a'.repeat(64)}`,
  createdAt: new Date('2026-07-16T12:00:00.000Z'),
};

describe('toPolicyDocument', () => {
  it('converts the effective and approval times to ISO strings', () => {
    const document = toPolicyDocument(ROW);

    expect(document.effectiveFrom).toBe('2026-08-01T05:00:00.000Z');
    expect(document.effectiveTo).toBe('2026-12-20T06:00:00.000Z');
    expect(document.approvedAt).toBe('2026-07-15T12:00:00.000Z');
  });

  it('keeps an open-ended document and a draft without approval time as null', () => {
    const document = toPolicyDocument({
      ...ROW,
      effectiveTo: null,
      approvalStatus: 'DRAFT',
      approvedAt: null,
    });

    expect(document.effectiveTo).toBeNull();
    expect(document.approvedAt).toBeNull();
  });

  it('rejects a stored row that violates the domain schema', () => {
    expect(() => toPolicyDocument({ ...ROW, approvedAt: null })).toThrow();
  });
});
