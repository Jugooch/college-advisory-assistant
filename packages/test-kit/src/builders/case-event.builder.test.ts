/**
 * @file Tests for the synthetic case event builders.
 */
import { describe, expect, it } from 'vitest';

import { CaseEventSchema, Role } from '@caa/domain';

import {
  buildCaseEvent,
  buildInReviewCaseEvents,
  buildResolvedCaseEvents,
} from './case-event.builder';

describe('buildCaseEvent', () => {
  it('defaults to the CREATE event, sequence 1, from no status to OPEN', () => {
    expect(buildCaseEvent()).toEqual({
      id: 'f1000000-0000-4000-8000-000000000001',
      caseId: 'f0000000-0000-4000-8000-000000000001',
      sequence: 1,
      action: 'CREATE',
      actorUserId: '20000000-0000-4000-8000-000000000001',
      actorRole: 'STUDENT',
      at: '2026-09-22T10:00:00.000-05:00',
      fromStatus: null,
      toStatus: 'OPEN',
      resolution: null,
      note: null,
    });
  });

  it('derives the id from the seed', () => {
    expect(buildCaseEvent({}, 8).id).toBe('f1000000-0000-4000-8000-000000000008');
  });

  it('lets an override win, including ADMIN', () => {
    expect(buildCaseEvent({ actorRole: Role.Admin }).actorRole).toBe('ADMIN');
  });

  it('rejects a note on a non-RESOLVE event', () => {
    expect(() => buildCaseEvent({ note: 'not allowed' })).toThrow();
  });
});

describe('case event histories', () => {
  it('sets STUDENT on the CREATE event and ADVISOR on the staff events', () => {
    expect(buildResolvedCaseEvents().map((event) => event.actorRole)).toEqual([
      'STUDENT',
      'ADVISOR',
      'ADVISOR',
    ]);
  });

  it('chains each fromStatus to the previous toStatus and numbers events from 1', () => {
    for (const events of [buildInReviewCaseEvents(), buildResolvedCaseEvents()]) {
      events.forEach((event, index) => {
        expect(CaseEventSchema.safeParse(event).success).toBe(true);
        expect(event.sequence).toBe(index + 1);
        expect(event.fromStatus).toBe(events[index - 1]?.toStatus ?? null);
      });
    }
  });

  it('ends the resolved history with a RESOLVE event that records the resolution', () => {
    const last = buildResolvedCaseEvents().at(-1);

    expect(last?.action).toBe('RESOLVE');
    expect(last?.resolution).toBe('PLAN_REVIEWED');
  });

  it('gives histories of different cases distinct ids and the case id', () => {
    const events = buildResolvedCaseEvents(2);

    expect(new Set(events.map((e) => e.id)).size).toBe(3);
    expect(events.every((e) => e.caseId === 'f0000000-0000-4000-8000-000000000002')).toBe(true);
  });
});
