/**
 * @file Tests for the synthetic case view, case event view and queue row builders.
 */
import { describe, expect, it } from 'vitest';

import { CaseEventViewSchema, CaseQueueItemSchema, CaseViewSchema } from '@caa/api-contract';

import {
  buildCaseEventView,
  buildCaseQueueItem,
  buildCaseView,
  buildClaimCaseEventView,
  buildInReviewCaseView,
  buildResolveCaseEventView,
  buildResolvedCaseView,
  buildSourceDiscrepancyCaseView,
  buildUnroutedCaseQueueItem,
} from './case-view.builder';
import { buildPlanRevisionView } from './plan-revision-view.builder';

describe('case event view builders', () => {
  it('builds CREATE, CLAIM and RESOLVE events with role actors and no user ID', () => {
    const events = [buildCaseEventView(), buildClaimCaseEventView(), buildResolveCaseEventView()];

    for (const event of events) {
      expect(CaseEventViewSchema.safeParse(event).success).toBe(true);
      expect(event).not.toHaveProperty('actorUserId');
    }
    expect(events.map((event) => [event.sequence, event.actorRole, event.isYou])).toEqual([
      [1, 'STUDENT', true],
      [2, 'ADVISOR', false],
      [3, 'ADVISOR', false],
    ]);
    expect(events[2]?.resolution).toBe('PLAN_REVIEWED');
  });

  it('fails loudly for a resolution on a non-RESOLVE event', () => {
    expect(() => buildCaseEventView({ resolution: 'PLAN_REVIEWED' })).toThrow();
  });
});

describe('buildCaseView', () => {
  it('defaults to an OPEN plan-review case with the frozen context it names', () => {
    const view = buildCaseView();

    expect(CaseViewSchema.safeParse(view).success).toBe(true);
    expect(view).toMatchObject({
      id: 'f0000000-0000-4000-8000-000000000001',
      status: 'OPEN',
      owner: null,
      lastSequence: 1,
      allowedActions: [],
    });
    expect(view.context?.id).toBe(view.planRevisionId);
    expect(view.context?.freshness.state).toBe('CURRENT');
  });

  it('follows a context override', () => {
    const context = buildPlanRevisionView({}, 2);

    expect(buildCaseView({ context }).planRevisionId).toBe(context.id);
  });

  it('builds an IN_REVIEW case owned by the viewing advisor', () => {
    const view = buildInReviewCaseView();

    expect(view.status).toBe('IN_REVIEW');
    expect(view.owner).toEqual({ role: 'ADVISOR', isYou: true });
    expect(view.events.map((event) => event.action)).toEqual(['CREATE', 'CLAIM']);
    expect(view.allowedActions).toEqual(['RELEASE', 'RESOLVE']);
  });

  it('builds a RESOLVED case with no allowed actions', () => {
    const view = buildResolvedCaseView();

    expect(view.status).toBe('RESOLVED');
    expect(view.lastSequence).toBe(3);
    expect(view.events.map((event) => event.action)).toEqual(['CREATE', 'CLAIM', 'RESOLVE']);
    expect(view.allowedActions).toEqual([]);
  });

  it('builds a source-discrepancy case with no revision and no context', () => {
    const view = buildSourceDiscrepancyCaseView();

    expect(view).toMatchObject({
      reason: 'SOURCE_DISCREPANCY',
      planRevisionId: null,
      context: null,
      discrepancySubject: 'AUDIT_REQUIREMENT',
    });
  });

  it('fails loudly when the status does not fit the event chain', () => {
    expect(() => buildCaseView({ status: 'IN_REVIEW' })).toThrow();
  });
});

describe('case queue item builders', () => {
  it('builds a routed row that carries no note, owner ID or student name', () => {
    const item = buildCaseQueueItem();

    expect(CaseQueueItemSchema.safeParse(item).success).toBe(true);
    expect(item).toMatchObject({ routed: true, ownerIsYou: false, status: 'OPEN' });
    expect(Object.keys(item).sort()).toEqual([
      'caseId',
      'createdAt',
      'ownerIsYou',
      'reason',
      'routed',
      'status',
      'studentId',
    ]);
  });

  it('builds an unrouted row', () => {
    expect(buildUnroutedCaseQueueItem().routed).toBe(false);
  });

  it('derives the case ID from the seed', () => {
    expect(buildCaseQueueItem({}, 5).caseId).toBe('f0000000-0000-4000-8000-000000000005');
  });
});
