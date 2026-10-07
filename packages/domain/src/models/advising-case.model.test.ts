/**
 * @file Tests for the advising case data object.
 */
import { describe, expect, it } from 'vitest';

import { type AdvisingCaseInput, createAdvisingCase } from './advising-case.model';

const VALID: AdvisingCaseInput = {
  id: '4d5e6f70-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '2b3c4d5e-0000-4000-8000-000000000001',
  reason: 'PLAN_REVIEW',
  planRevisionId: '5e6f7081-0000-4000-8000-000000000001',
  discrepancySubject: null,
  studentNote: 'Please check my spring plan.',
  status: 'OPEN',
  ownerUserId: null,
  createdAt: '2026-10-07T09:00:00.000-05:00',
  lastSequence: 1,
};
const OWNER = '1a2b3c4d-0000-4000-8000-000000000002';
const DISCREPANCY: AdvisingCaseInput = {
  ...VALID,
  reason: 'SOURCE_DISCREPANCY',
  discrepancySubject: 'SECTION',
  planRevisionId: null,
};

describe('createAdvisingCase', () => {
  it('accepts an open plan-review case and trims the note', () => {
    const made = createAdvisingCase({ ...VALID, studentNote: '  hello  ' });
    expect(made.studentNote).toBe('hello');
    expect(made.ownerUserId).toBeNull();
  });

  it('bounds the note to 1-500 characters', () => {
    expect(createAdvisingCase({ ...VALID, studentNote: 'a'.repeat(500) }).studentNote).toHaveLength(
      500,
    );
    expect(() => createAdvisingCase({ ...VALID, studentNote: 'a'.repeat(501) })).toThrow();
    expect(() => createAdvisingCase({ ...VALID, studentNote: '   ' })).toThrow();
  });

  it('requires a revision unless the reason is a discrepancy', () => {
    expect(() => createAdvisingCase({ ...VALID, planRevisionId: null })).toThrow();
    expect(createAdvisingCase(DISCREPANCY).planRevisionId).toBeNull();
    expect(
      createAdvisingCase({ ...DISCREPANCY, planRevisionId: VALID.planRevisionId }).planRevisionId,
    ).toBe(VALID.planRevisionId);
  });

  it('requires a subject exactly for a discrepancy', () => {
    expect(() => createAdvisingCase({ ...DISCREPANCY, discrepancySubject: null })).toThrow();
    expect(() => createAdvisingCase({ ...VALID, discrepancySubject: 'SECTION' })).toThrow();
  });

  it('sets the owner exactly for IN_REVIEW and RESOLVED', () => {
    expect(createAdvisingCase({ ...VALID, status: 'IN_REVIEW', ownerUserId: OWNER }).status).toBe(
      'IN_REVIEW',
    );
    expect(createAdvisingCase({ ...VALID, status: 'RESOLVED', ownerUserId: OWNER }).status).toBe(
      'RESOLVED',
    );
    expect(() => createAdvisingCase({ ...VALID, status: 'IN_REVIEW' })).toThrow();
    expect(() => createAdvisingCase({ ...VALID, status: 'RESOLVED' })).toThrow();
    expect(() => createAdvisingCase({ ...VALID, ownerUserId: OWNER })).toThrow();
    expect(() =>
      createAdvisingCase({ ...VALID, status: 'WITHDRAWN', ownerUserId: OWNER }),
    ).toThrow();
    expect(createAdvisingCase({ ...VALID, status: 'WITHDRAWN' }).ownerUserId).toBeNull();
  });

  it('rejects a lastSequence below 1 and a non-UUID ID', () => {
    expect(() => createAdvisingCase({ ...VALID, lastSequence: 0 })).toThrow();
    expect(() => createAdvisingCase({ ...VALID, id: 'nope' })).toThrow();
  });
});
