/**
 * @file Tests for the case event data object.
 */
import { describe, expect, it } from 'vitest';

import {
  type CaseEventInput,
  createCaseEvent,
  isCaseEventOriginValid,
  isCaseResolutionPlacementValid,
} from './case-event.model';

const CREATE: CaseEventInput = {
  id: '6f708192-0000-4000-8000-000000000001',
  caseId: '4d5e6f70-0000-4000-8000-000000000001',
  sequence: 1,
  action: 'CREATE',
  actorUserId: '1a2b3c4d-0000-4000-8000-000000000002',
  at: '2026-10-07T09:00:00.000-05:00',
  fromStatus: null,
  toStatus: 'OPEN',
  resolution: null,
  note: null,
};
const CLAIM: CaseEventInput = {
  ...CREATE,
  sequence: 2,
  action: 'CLAIM',
  fromStatus: 'OPEN',
  toStatus: 'IN_REVIEW',
};
const RESOLVE: CaseEventInput = {
  ...CLAIM,
  sequence: 3,
  action: 'RESOLVE',
  fromStatus: 'IN_REVIEW',
  toStatus: 'RESOLVED',
  resolution: 'PLAN_REVIEWED',
  note: 'Looks fine.',
};

describe('createCaseEvent', () => {
  it('accepts CREATE, CLAIM and RESOLVE shapes', () => {
    expect(createCaseEvent(CREATE).fromStatus).toBeNull();
    expect(createCaseEvent(CLAIM).toStatus).toBe('IN_REVIEW');
    expect(createCaseEvent(RESOLVE).resolution).toBe('PLAN_REVIEWED');
  });

  it('requires fromStatus null and sequence 1 exactly for CREATE', () => {
    expect(() => createCaseEvent({ ...CREATE, fromStatus: 'OPEN' })).toThrow();
    expect(() => createCaseEvent({ ...CREATE, sequence: 2 })).toThrow();
    expect(() => createCaseEvent({ ...CLAIM, fromStatus: null })).toThrow();
    expect(() => createCaseEvent({ ...CLAIM, sequence: 1 })).toThrow();
    expect(() => createCaseEvent({ ...CREATE, sequence: 0 })).toThrow();
  });

  it('requires a resolution exactly on RESOLVE', () => {
    expect(() => createCaseEvent({ ...RESOLVE, resolution: null })).toThrow();
    expect(() => createCaseEvent({ ...CLAIM, resolution: 'PLAN_REVIEWED' })).toThrow();
  });

  it('allows a note only on RESOLVE, up to 1,000 characters', () => {
    expect(() => createCaseEvent({ ...CLAIM, note: 'x' })).toThrow();
    expect(createCaseEvent({ ...RESOLVE, note: 'a'.repeat(1000) }).note).toHaveLength(1000);
    expect(() => createCaseEvent({ ...RESOLVE, note: 'a'.repeat(1001) })).toThrow();
    expect(createCaseEvent({ ...RESOLVE, note: null }).note).toBeNull();
  });
});

describe('shared case event invariants', () => {
  it('allows no prior status and sequence 1 only for CREATE', () => {
    expect(isCaseEventOriginValid({ action: 'CREATE', sequence: 1, fromStatus: null })).toBe(true);
    expect(isCaseEventOriginValid({ action: 'CREATE', sequence: 2, fromStatus: null })).toBe(false);
    expect(isCaseEventOriginValid({ action: 'CREATE', sequence: 1, fromStatus: 'OPEN' })).toBe(
      false,
    );
    expect(isCaseEventOriginValid({ action: 'CLAIM', sequence: 2, fromStatus: 'OPEN' })).toBe(true);
    expect(isCaseEventOriginValid({ action: 'CLAIM', sequence: 1, fromStatus: 'OPEN' })).toBe(
      false,
    );
    expect(isCaseEventOriginValid({ action: 'CLAIM', sequence: 2, fromStatus: null })).toBe(false);
  });

  it('allows a resolution and note only with RESOLVE', () => {
    const none = { resolution: null, note: null };
    expect(isCaseResolutionPlacementValid({ action: 'CLAIM', ...none })).toBe(true);
    expect(isCaseResolutionPlacementValid({ action: 'RESOLVE', ...none })).toBe(false);
    expect(
      isCaseResolutionPlacementValid({
        action: 'RESOLVE',
        resolution: 'PLAN_REVIEWED',
        note: null,
      }),
    ).toBe(true);
    expect(
      isCaseResolutionPlacementValid({ action: 'RESOLVE', resolution: 'PLAN_REVIEWED', note: 'x' }),
    ).toBe(true);
    expect(
      isCaseResolutionPlacementValid({ action: 'CLAIM', resolution: 'PLAN_REVIEWED', note: null }),
    ).toBe(false);
    expect(isCaseResolutionPlacementValid({ action: 'CLAIM', resolution: null, note: 'x' })).toBe(
      false,
    );
  });
});
