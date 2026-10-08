/**
 * @file Tests that case views name actors by role and `isYou` only, and never carry a user ID.
 * @requirement FR-14
 */
import { describe, expect, it } from 'vitest';

import { CaseViewSchema } from '@caa/api-contract';
import { CaseAction, CaseStatus, Role } from '@caa/domain';
import {
  buildActor,
  buildCaseEvent,
  buildInReviewAdvisingCase,
  buildInReviewCaseEvents,
  buildPlanRevisionView,
  syntheticId,
} from '@caa/test-kit';

import { toCaseSummary, toCaseView } from './cases.mapper';

const student = buildActor({ roles: [Role.Student] }, 1);
const advisor = buildActor({ roles: [Role.Advisor] }, 2);
const admin = buildActor({ roles: [Role.Admin] }, 4);
const advisingCase = buildInReviewAdvisingCase();
const events = buildInReviewCaseEvents();
const context = buildPlanRevisionView({
  id: advisingCase.planRevisionId ?? syntheticId('planRevision', 1),
});

/**
 * Builds a view for a viewer.
 *
 * @param viewer - The signed-in actor.
 * @returns The view.
 */
function viewFor(viewer: typeof student) {
  return toCaseView({
    advisingCase,
    events,
    studentUserId: student.userId,
    viewer,
    context,
    allowedActions: [CaseAction.Release],
  });
}

describe('toCaseView', () => {
  it('produces a view that satisfies the contract', () => {
    expect(() => CaseViewSchema.parse(viewFor(advisor))).not.toThrow();
  });

  it('shows the owner and the claim as the viewer with isYou', () => {
    const view = viewFor(advisor);

    expect(view.owner).toEqual({ role: Role.Advisor, isYou: true });
    expect(view.events.map((event) => [event.actorRole, event.isYou])).toEqual([
      [Role.Student, false],
      [Role.Advisor, true],
    ]);
  });

  it('shows the student their own CREATE as isYou and the owner as someone else', () => {
    const view = viewFor(student);

    expect(view.events[0]).toMatchObject({ actorRole: Role.Student, isYou: true });
    expect(view.owner).toEqual({ role: Role.Advisor, isYou: false });
  });

  it('shows an admin-only viewer who owns the case as ADMIN', () => {
    const view = toCaseView({
      advisingCase: { ...advisingCase, ownerUserId: admin.userId },
      events: [
        ...events.slice(0, 1),
        buildCaseEvent({ ...events[1], actorUserId: admin.userId }, 2),
      ],
      studentUserId: student.userId,
      viewer: admin,
      context,
      allowedActions: [],
    });

    expect(view.owner).toEqual({ role: Role.Admin, isYou: true });
  });

  it('never carries a user ID or tenant ID', () => {
    const raw = JSON.stringify(viewFor(advisor));

    for (const id of [student.userId, advisor.userId, advisingCase.tenantId]) {
      expect(raw).not.toContain(id);
    }
  });

  it('shows no owner when the case has none', () => {
    const open = toCaseView({
      advisingCase: { ...advisingCase, status: CaseStatus.Open, ownerUserId: null },
      events: events.slice(0, 1),
      studentUserId: student.userId,
      viewer: student,
      context,
      allowedActions: [],
    });

    expect(open.owner).toBeNull();
  });
});

describe('toCaseSummary', () => {
  it('keeps only the list fields, with no note or owner', () => {
    const summary = toCaseSummary(advisingCase);

    expect(Object.keys(summary).sort()).toEqual([
      'createdAt',
      'discrepancySubject',
      'id',
      'planRevisionId',
      'reason',
      'status',
    ]);
    expect(summary.planRevisionId).toBe(
      advisingCase.planRevisionId ?? syntheticId('planRevision', 1),
    );
  });
});
