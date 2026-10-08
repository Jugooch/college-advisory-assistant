/**
 * @file Tests that case views name actors by role and `isYou` only, and never carry a user ID.
 * @requirement FR-14
 */
import { describe, expect, it } from 'vitest';

import { CaseQueueItemSchema, CaseViewSchema } from '@caa/api-contract';
import { CaseAction, CaseStatus, Role } from '@caa/domain';
import {
  buildActor,
  buildCaseEvent,
  buildInReviewAdvisingCase,
  buildInReviewCaseEvents,
  buildPlanRevisionView,
  syntheticId,
} from '@caa/test-kit';

import { toCaseQueueItem, toCaseSummary, toCaseView } from './cases.mapper';

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
        buildCaseEvent({ ...events[1], actorUserId: admin.userId, actorRole: Role.Admin }, 2),
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

describe('toCaseQueueItem', () => {
  it('marks the viewer’s own case and carries no note, owner ID or user ID', () => {
    const item = toCaseQueueItem(advisingCase, { viewerUserId: advisor.userId, routed: true });

    expect(() => CaseQueueItemSchema.parse(item)).not.toThrow();
    expect(item).toMatchObject({ caseId: advisingCase.id, ownerIsYou: true, routed: true });
    expect(JSON.stringify(item)).not.toContain(advisor.userId);
    expect(JSON.stringify(item)).not.toContain(advisingCase.studentNote);
  });

  it('is not the viewer’s case for another viewer, and keeps routed false', () => {
    const item = toCaseQueueItem(advisingCase, { viewerUserId: admin.userId, routed: false });

    expect(item).toMatchObject({ ownerIsYou: false, routed: false });
  });
});

describe('toCaseView stored roles', () => {
  const adminClaim = [
    buildCaseEvent({ caseId: advisingCase.id }, 1),
    buildCaseEvent(
      {
        ...events[1],
        actorUserId: admin.userId,
        actorRole: Role.Admin,
      },
      2,
    ),
  ];

  it.each([student, advisor, admin])(
    'shows an admin CLAIM and the owner as ADMIN to every viewer',
    (viewer) => {
      const view = toCaseView({
        advisingCase: { ...advisingCase, ownerUserId: admin.userId },
        events: adminClaim,
        studentUserId: student.userId,
        viewer,
        context,
        allowedActions: [],
      });

      expect(view.events[1]?.actorRole).toBe(Role.Admin);
      expect(view.owner?.role).toBe(Role.Admin);
    },
  );

  it('takes the owner role from the latest CLAIM event', () => {
    const released = [
      ...adminClaim,
      buildCaseEvent(
        {
          sequence: 3,
          action: CaseAction.Release,
          actorUserId: admin.userId,
          actorRole: Role.Admin,
          fromStatus: CaseStatus.InReview,
          toStatus: CaseStatus.Open,
        },
        3,
      ),
      buildCaseEvent(
        {
          sequence: 4,
          action: CaseAction.Claim,
          actorUserId: advisor.userId,
          actorRole: Role.Advisor,
          fromStatus: CaseStatus.Open,
          toStatus: CaseStatus.InReview,
        },
        4,
      ),
    ];

    const view = toCaseView({
      advisingCase: { ...advisingCase, ownerUserId: advisor.userId },
      events: released,
      studentUserId: student.userId,
      viewer: student,
      context,
      allowedActions: [],
    });

    expect(view.owner?.role).toBe(Role.Advisor);
  });
});
