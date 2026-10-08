/**
 * @file Tests for the case event data object.
 */
import { describe, expect, it } from 'vitest';

import { Role } from '../enums/role.enum';
import { type CaseEventInput, createCaseEvent } from './case-event.model';

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

describe('CaseEvent actorRole', () => {
  it.each(Object.values(Role))('accepts role %s', (role) => {
    expect(createCaseEvent({ ...CREATE, actorRole: role }).actorRole).toBe(role);
  });

  it('accepts the field being absent', () => {
    expect(createCaseEvent(CREATE).actorRole).toBeUndefined();
  });

  it('rejects an unknown role', () => {
    expect(() => createCaseEvent({ ...CREATE, actorRole: 'ROOT' as never })).toThrow();
  });
});
