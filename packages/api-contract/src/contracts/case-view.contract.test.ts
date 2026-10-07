/**
 * @file Tests for the case view and its events.
 */
import { describe, expect, it } from 'vitest';

import { buildRevisionView, REVISION_ID } from '../testing/plan-draft-fixtures';
import { CaseEventViewSchema, CaseViewSchema } from './case-view.contract';

const CREATE = {
  id: '6f708192-0000-4000-8000-000000000001',
  sequence: 1,
  action: 'CREATE',
  actorRole: 'STUDENT',
  isYou: true,
  at: '2026-10-07T09:00:00.000-05:00',
  fromStatus: null,
  toStatus: 'OPEN',
  resolution: null,
  note: null,
};
const CLAIM = {
  ...CREATE,
  id: '6f708192-0000-4000-8000-000000000002',
  sequence: 2,
  action: 'CLAIM',
  actorRole: 'ADVISOR',
  isYou: false,
  fromStatus: 'OPEN',
  toStatus: 'IN_REVIEW',
};
const RESOLVE = {
  ...CLAIM,
  id: '6f708192-0000-4000-8000-000000000003',
  sequence: 3,
  action: 'RESOLVE',
  fromStatus: 'IN_REVIEW',
  toStatus: 'RESOLVED',
  resolution: 'PLAN_REVIEWED',
  note: 'Reviewed.',
};
const OPEN_VIEW = {
  id: '4d5e6f70-0000-4000-8000-000000000001',
  studentId: '2b3c4d5e-0000-4000-8000-000000000001',
  reason: 'PLAN_REVIEW',
  planRevisionId: REVISION_ID,
  context: buildRevisionView(),
  discrepancySubject: null,
  studentNote: 'Please check my spring plan.',
  status: 'OPEN',
  owner: null,
  createdAt: '2026-10-07T09:00:00.000-05:00',
  lastSequence: 1,
  events: [CREATE],
  allowedActions: ['CLAIM', 'WITHDRAW'],
};
const IN_REVIEW_VIEW = {
  ...OPEN_VIEW,
  status: 'IN_REVIEW',
  owner: { role: 'ADVISOR', isYou: true },
  lastSequence: 2,
  events: [CREATE, CLAIM],
  allowedActions: ['RELEASE', 'RESOLVE'],
};
const RESOLVED_VIEW = {
  ...IN_REVIEW_VIEW,
  status: 'RESOLVED',
  lastSequence: 3,
  events: [CREATE, CLAIM, RESOLVE],
  allowedActions: [],
};

describe('CaseEventViewSchema', () => {
  const accepts = (event: unknown): boolean => CaseEventViewSchema.safeParse(event).success;

  it('accepts CREATE, CLAIM and RESOLVE events', () => {
    expect(accepts(CREATE)).toBe(true);
    expect(accepts(CLAIM)).toBe(true);
    expect(accepts(RESOLVE)).toBe(true);
  });

  it.each(['actorUserId', 'userId', 'actorName', 'email'])(
    'rejects %s so no event exposes a user',
    (field) => {
      expect(accepts({ ...CLAIM, [field]: '1a2b3c4d-0000-4000-8000-000000000002' })).toBe(false);
    },
  );

  it('requires a role, never a free-text actor', () => {
    expect(accepts({ ...CLAIM, actorRole: 'Dr. Smith' })).toBe(false);
    expect(accepts({ ...CLAIM, isYou: undefined })).toBe(false);
  });

  it('requires null fromStatus and sequence 1 exactly for CREATE', () => {
    expect(accepts({ ...CREATE, fromStatus: 'OPEN' })).toBe(false);
    expect(accepts({ ...CREATE, sequence: 2 })).toBe(false);
    expect(accepts({ ...CLAIM, fromStatus: null })).toBe(false);
    expect(accepts({ ...CLAIM, sequence: 1 })).toBe(false);
  });

  it('allows a resolution and note only on RESOLVE, with a note up to 1,000 characters', () => {
    expect(accepts({ ...RESOLVE, resolution: null })).toBe(false);
    expect(accepts({ ...CLAIM, resolution: 'PLAN_REVIEWED' })).toBe(false);
    expect(accepts({ ...CLAIM, note: 'x' })).toBe(false);
    expect(accepts({ ...RESOLVE, note: 'a'.repeat(1000) })).toBe(true);
    expect(accepts({ ...RESOLVE, note: 'a'.repeat(1001) })).toBe(false);
    expect(accepts({ ...RESOLVE, note: null })).toBe(true);
  });
});

describe('CaseViewSchema', () => {
  const accepts = (view: unknown): boolean => CaseViewSchema.safeParse(view).success;

  it('accepts open, in-review and resolved views', () => {
    expect(accepts(OPEN_VIEW)).toBe(true);
    expect(accepts(IN_REVIEW_VIEW)).toBe(true);
    expect(accepts(RESOLVED_VIEW)).toBe(true);
  });

  it('accepts a discrepancy view with no revision', () => {
    expect(
      accepts({
        ...OPEN_VIEW,
        reason: 'SOURCE_DISCREPANCY',
        planRevisionId: null,
        context: null,
        discrepancySubject: 'SECTION',
      }),
    ).toBe(true);
  });

  it.each(['tenantId', 'ownerUserId', 'userId'])('rejects %s on the view', (field) => {
    expect(accepts({ ...OPEN_VIEW, [field]: 'x' })).toBe(false);
  });

  it('rejects an owner that carries a user ID', () => {
    expect(
      accepts({ ...IN_REVIEW_VIEW, owner: { role: 'ADVISOR', isYou: false, userId: 'u' } }),
    ).toBe(false);
  });

  it('rejects a reason that does not fit the revision or subject', () => {
    expect(accepts({ ...OPEN_VIEW, planRevisionId: null, context: null })).toBe(false);
    expect(accepts({ ...OPEN_VIEW, discrepancySubject: 'SECTION' })).toBe(false);
    expect(accepts({ ...OPEN_VIEW, reason: 'SOURCE_DISCREPANCY', planRevisionId: null })).toBe(
      false,
    );
  });

  it('bounds the student note to 1 to 500 characters', () => {
    expect(accepts({ ...OPEN_VIEW, studentNote: 'a'.repeat(500) })).toBe(true);
    expect(accepts({ ...OPEN_VIEW, studentNote: 'a'.repeat(501) })).toBe(false);
    expect(accepts({ ...OPEN_VIEW, studentNote: '' })).toBe(false);
  });

  it('requires an owner exactly when IN_REVIEW or RESOLVED', () => {
    expect(accepts({ ...OPEN_VIEW, owner: { role: 'ADVISOR', isYou: true } })).toBe(false);
    expect(accepts({ ...IN_REVIEW_VIEW, owner: null })).toBe(false);
    expect(accepts({ ...RESOLVED_VIEW, owner: null })).toBe(false);
  });

  it('rejects a status that the last event does not end at', () => {
    expect(accepts({ ...IN_REVIEW_VIEW, status: 'OPEN', owner: null })).toBe(false);
    expect(accepts({ ...OPEN_VIEW, status: 'WITHDRAWN' })).toBe(false);
  });

  it('rejects a lastSequence that is not the last event', () => {
    expect(accepts({ ...IN_REVIEW_VIEW, lastSequence: 3 })).toBe(false);
    expect(accepts({ ...IN_REVIEW_VIEW, lastSequence: 1 })).toBe(false);
  });

  it('rejects no events, a gap, and a chain whose statuses do not connect', () => {
    expect(accepts({ ...OPEN_VIEW, events: [] })).toBe(false);
    expect(accepts({ ...IN_REVIEW_VIEW, events: [CLAIM] })).toBe(false);
    expect(
      accepts({
        ...IN_REVIEW_VIEW,
        events: [CREATE, { ...CLAIM, fromStatus: 'IN_REVIEW', toStatus: 'IN_REVIEW' }],
      }),
    ).toBe(false);
  });

  it('rejects a repeated action in allowedActions and accepts none', () => {
    expect(accepts({ ...OPEN_VIEW, allowedActions: ['CLAIM', 'CLAIM'] })).toBe(false);
    expect(accepts({ ...OPEN_VIEW, allowedActions: [] })).toBe(true);
  });

  it('rejects a user ID in the context revision', () => {
    const context = buildRevisionView({ createdBy: '1a2b3c4d-0000-4000-8000-000000000002' });

    expect(accepts({ ...OPEN_VIEW, context })).toBe(false);
    expect(JSON.stringify(CaseViewSchema.parse(OPEN_VIEW))).not.toMatch(/createdBy|UserId/);
  });

  it('shows the referenced revision as stored, with its freshness', () => {
    const stale = {
      state: 'STALE',
      reasons: ['AUDIT_SUPERSEDED'],
      checkedAt: '2026-10-08T09:00:00.000-05:00',
    };

    expect(accepts({ ...OPEN_VIEW, context: buildRevisionView({ freshness: stale }) })).toBe(true);
  });

  it('rejects a context that is not the named revision, or null while one is named', () => {
    const other = buildRevisionView({ id: '7a000000-0000-4000-8000-000000000002' });

    expect(accepts({ ...OPEN_VIEW, context: other })).toBe(false);
    expect(accepts({ ...OPEN_VIEW, context: null })).toBe(false);
  });

  it('rejects a context when no revision is named', () => {
    expect(
      accepts({
        ...OPEN_VIEW,
        reason: 'SOURCE_DISCREPANCY',
        planRevisionId: null,
        discrepancySubject: 'SECTION',
      }),
    ).toBe(false);
  });
});
