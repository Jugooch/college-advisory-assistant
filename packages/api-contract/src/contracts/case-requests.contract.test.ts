/**
 * @file Tests for the case request bodies and the queue query.
 */
import { describe, expect, it } from 'vitest';

import {
  CaseEventRequestSchema,
  CaseQueueQuerySchema,
  CreateCaseRequestSchema,
} from './case-requests.contract';

const REVISION = '5e6f7081-0000-4000-8000-000000000001';
const REVIEW = {
  reason: 'PLAN_REVIEW',
  planRevisionId: REVISION,
  discrepancySubject: null,
  studentNote: 'Please check my spring plan.',
};
const DISCREPANCY = {
  reason: 'SOURCE_DISCREPANCY',
  planRevisionId: null,
  discrepancySubject: 'SECTION',
  studentNote: 'The section time looks wrong.',
};

describe('CreateCaseRequestSchema', () => {
  const accepts = (body: unknown): boolean => CreateCaseRequestSchema.safeParse(body).success;

  it('accepts a plan review and a discrepancy', () => {
    expect(accepts(REVIEW)).toBe(true);
    expect(accepts({ ...REVIEW, reason: 'NEEDS_VERIFICATION' })).toBe(true);
    expect(accepts(DISCREPANCY)).toBe(true);
  });

  it('accepts a discrepancy that also names a revision', () => {
    expect(accepts({ ...DISCREPANCY, planRevisionId: REVISION })).toBe(true);
  });

  it('rejects a plan review or verification without a revision', () => {
    expect(accepts({ ...REVIEW, planRevisionId: null })).toBe(false);
    expect(accepts({ ...REVIEW, reason: 'NEEDS_VERIFICATION', planRevisionId: null })).toBe(false);
  });

  it('rejects a discrepancy without a subject and a subject on another reason', () => {
    expect(accepts({ ...DISCREPANCY, discrepancySubject: null })).toBe(false);
    expect(accepts({ ...REVIEW, discrepancySubject: 'SECTION' })).toBe(false);
  });

  it('rejects an omitted nullable field and a non-UUID revision', () => {
    expect(accepts({ ...REVIEW, planRevisionId: undefined })).toBe(false);
    expect(accepts({ ...REVIEW, planRevisionId: 'rev-1' })).toBe(false);
  });

  it('bounds the note to 1 to 500 characters', () => {
    expect(accepts({ ...REVIEW, studentNote: 'a'.repeat(500) })).toBe(true);
    expect(accepts({ ...REVIEW, studentNote: 'a'.repeat(501) })).toBe(false);
    expect(accepts({ ...REVIEW, studentNote: 'a' })).toBe(true);
    expect(accepts({ ...REVIEW, studentNote: '' })).toBe(false);
    expect(accepts({ ...REVIEW, studentNote: '   ' })).toBe(false);
  });

  it.each(['tenantId', 'userId', 'role', 'roles', 'ownerUserId', 'status', 'studentId'])(
    'rejects %s in the body',
    (field) => {
      expect(accepts({ ...REVIEW, [field]: 'x' })).toBe(false);
    },
  );
});

describe('CaseEventRequestSchema', () => {
  const accepts = (body: unknown): boolean => CaseEventRequestSchema.safeParse(body).success;

  it('accepts CLAIM, RELEASE and WITHDRAW with only a sequence', () => {
    for (const action of ['CLAIM', 'RELEASE', 'WITHDRAW']) {
      expect(accepts({ action, expectedSequence: 1 })).toBe(true);
    }
  });

  it('accepts RESOLVE with a resolution, with or without a note', () => {
    const resolve = { action: 'RESOLVE', expectedSequence: 2, resolution: 'PLAN_REVIEWED' };

    expect(accepts(resolve)).toBe(true);
    expect(accepts({ ...resolve, note: 'Looks fine.' })).toBe(true);
  });

  it('rejects CREATE and unknown actions', () => {
    expect(accepts({ action: 'CREATE', expectedSequence: 1 })).toBe(false);
    expect(accepts({ action: 'APPROVE', expectedSequence: 1 })).toBe(false);
  });

  it('rejects RESOLVE without a resolution', () => {
    expect(accepts({ action: 'RESOLVE', expectedSequence: 2 })).toBe(false);
    expect(accepts({ action: 'RESOLVE', expectedSequence: 2, note: 'Done.' })).toBe(false);
  });

  it('rejects a resolution or a note on any other action', () => {
    expect(accepts({ action: 'CLAIM', expectedSequence: 1, resolution: 'PLAN_REVIEWED' })).toBe(
      false,
    );
    expect(accepts({ action: 'WITHDRAW', expectedSequence: 1, note: 'x' })).toBe(false);
  });

  it('bounds the note to 1 to 1,000 characters', () => {
    const resolve = { action: 'RESOLVE', expectedSequence: 2, resolution: 'PLAN_REVIEWED' };

    expect(accepts({ ...resolve, note: 'a'.repeat(1000) })).toBe(true);
    expect(accepts({ ...resolve, note: 'a'.repeat(1001) })).toBe(false);
    expect(accepts({ ...resolve, note: '' })).toBe(false);
  });

  it('requires an integer sequence of at least 1', () => {
    expect(accepts({ action: 'CLAIM', expectedSequence: 1 })).toBe(true);
    expect(accepts({ action: 'CLAIM', expectedSequence: 0 })).toBe(false);
    expect(accepts({ action: 'CLAIM', expectedSequence: 1.5 })).toBe(false);
    expect(accepts({ action: 'CLAIM' })).toBe(false);
  });

  it.each(['tenantId', 'userId', 'role', 'ownerUserId', 'status', 'actorUserId'])(
    'rejects %s in the body',
    (field) => {
      expect(accepts({ action: 'CLAIM', expectedSequence: 1, [field]: 'x' })).toBe(false);
    },
  );
});

describe('CaseQueueQuerySchema', () => {
  it('accepts no filter or a known status', () => {
    expect(CaseQueueQuerySchema.safeParse({}).success).toBe(true);
    expect(CaseQueueQuerySchema.safeParse({ status: 'OPEN' }).success).toBe(true);
  });

  it('rejects an unknown status and extra keys such as tenantId', () => {
    expect(CaseQueueQuerySchema.safeParse({ status: 'DONE' }).success).toBe(false);
    expect(CaseQueueQuerySchema.safeParse({ tenantId: 'x' }).success).toBe(false);
  });
});
