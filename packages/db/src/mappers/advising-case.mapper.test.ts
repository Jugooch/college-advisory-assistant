/**
 * @file Tests for the advising case and case event row mappers.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { AdvisingCaseRow } from '../tables/advising-case.table';
import type { CaseEventRow } from '../tables/case-event.table';
import { toAdvisingCase } from './advising-case.mapper';
import { toCaseEvent } from './case-event.mapper';

const CASE_ROW: AdvisingCaseRow = {
  id: '9f4e5d6c-7b8a-4f9e-a0d1-3c4d5e6f7081',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
  reason: 'PLAN_REVIEW',
  planRevisionId: '4d5e6f70-8192-4ca3-b4c5-d6e7f8091021',
  planId: '5e6f7081-92a3-4db4-85d6-e7f809102132',
  discrepancySubject: null,
  studentNote: 'Please check this plan.',
  status: 'OPEN',
  ownerUserId: null,
  createdAt: new Date('2026-10-02T15:00:00.000Z'),
  lastSequence: 1,
};

const EVENT_ROW: CaseEventRow = {
  id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  tenantId: CASE_ROW.tenantId,
  caseId: CASE_ROW.id,
  sequence: 3,
  action: 'RESOLVE',
  actorUserId: '5d1c2b3a-4f5e-4d6c-8b7a-1a2b3c4d5e6f',
  actorRole: 'ADVISOR',
  at: new Date('2026-10-03T15:00:00.000Z'),
  fromStatus: 'IN_REVIEW',
  toStatus: 'RESOLVED',
  resolution: 'PLAN_REVIEWED',
  note: 'Reviewed with the student.',
};

describe('toAdvisingCase', () => {
  it('converts the timestamp and omits the storage-only plan ID', () => {
    const advisingCase = toAdvisingCase(CASE_ROW);

    expect(advisingCase.createdAt).toBe('2026-10-02T15:00:00.000Z');
    expect(advisingCase).not.toHaveProperty('planId');
  });

  it('rejects an in-review row without an owner', () => {
    expect(() => toAdvisingCase({ ...CASE_ROW, status: 'IN_REVIEW' })).toThrow(ZodError);
  });

  it('keeps a withdrawn case unowned', () => {
    expect(toAdvisingCase({ ...CASE_ROW, status: 'WITHDRAWN' }).ownerUserId).toBeNull();
  });

  it('does not put the note in the validation error', () => {
    const bad = { ...CASE_ROW, studentNote: 'secret note text', status: 'IN_REVIEW' } as const;

    let thrown: unknown;
    try {
      toAdvisingCase(bad);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ZodError);
    expect(String(thrown)).not.toContain('secret note text');
  });
});

describe('toCaseEvent', () => {
  it('converts the timestamp and keeps the resolution', () => {
    const event = toCaseEvent(EVENT_ROW);

    expect(event).toMatchObject({ at: '2026-10-03T15:00:00.000Z', resolution: 'PLAN_REVIEWED' });
  });

  it('keeps the stored role', () => {
    expect(toCaseEvent(EVENT_ROW).actorRole).toBe('ADVISOR');
    expect(toCaseEvent({ ...EVENT_ROW, actorRole: 'ADMIN' }).actorRole).toBe('ADMIN');
  });

  it('rejects a resolution on a non-resolve event', () => {
    expect(() => toCaseEvent({ ...EVENT_ROW, action: 'CLAIM' })).toThrow(ZodError);
  });
});
