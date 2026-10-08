/**
 * @file Service tests for case actions with injected fakes: each action's status matches the
 * case logic, access is rechecked on every call, only the right actor may act, races and stale
 * sequences give a conflict, and one event and one log line (without the note) are written.
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-15
 */
import { describe, expect, it } from 'vitest';

import type { CaseEventRequest } from '@caa/api-contract';
import {
  type AdvisingCase,
  CaseAction,
  CaseResolution,
  CaseStatus,
  Role,
  StudentIdSchema,
} from '@caa/domain';
import {
  buildActor,
  buildAdvisingCase,
  buildAdvisorAssignment,
  buildCaseEvent,
  buildInReviewAdvisingCase,
  buildInReviewCaseEvents,
  buildPlanRevisionView,
  buildResolvedAdvisingCase,
  buildStudent,
} from '@caa/test-kit';

import {
  InvalidRequestError,
  NotFoundError,
  RevisionConflictError,
} from '../../shared/domain-errors';
import { createInMemoryCaseRepository } from '../../testing/in-memory-case-repositories';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { createCaseViewerService } from '../case-viewer/case-viewer.service';
import { createCaseActionsService } from './case-actions.service';

const NOW = new Date('2026-09-01T12:00:00.000Z');
const NOTE = 'A synthetic resolution note that must never be logged.';
const studentActor = buildActor({ roles: [Role.Student] }, 1);
const advisor = buildActor({ roles: [Role.Advisor] }, 2);
const otherAdvisor = buildActor({ roles: [Role.Advisor] }, 5);
const student = buildStudent({ userId: studentActor.userId }, 1);
const studentId = StudentIdSchema.parse(student.id);

/**
 * Builds the service over a store with the given case.
 *
 * @param stored - The case and its events.
 * @param canView - Whether the access rule lets the actor see the student.
 * @returns The service, store, logger and the case ID.
 */
function setup(stored: AdvisingCase, canView: (userId: string) => boolean = () => true) {
  const events =
    stored.status === CaseStatus.Open
      ? [buildCaseEvent({ caseId: stored.id, action: CaseAction.Create })]
      : buildInReviewCaseEvents();
  const store = { students: [student], cases: [stored], caseEvents: events };
  const logger = createRecordingLogger();
  const service = createCaseActionsService({
    access: { canViewStudent: (actor) => Promise.resolve(canView(actor.userId)) },
    cases: createInMemoryCaseRepository(store),
    students: { findById: () => Promise.resolve(student) },
    advisorAssignments: {
      findActive: () => Promise.resolve(buildAdvisorAssignment()),
    },
    caseViewer: createCaseViewerService({
      students: { findById: () => Promise.resolve(student) },
      caseContext: {
        hasRevision: () => Promise.resolve(true),
        contextOf: () => Promise.resolve(buildPlanRevisionView()),
      },
    }),
    now: () => NOW,
  });
  return { service, store, logger, caseId: stored.id };
}

const open = () => buildAdvisingCase({ studentId });
const inReview = () => buildInReviewAdvisingCase({ studentId });
const claim = (expectedSequence: number): CaseEventRequest => ({
  action: CaseAction.Claim,
  expectedSequence,
});
const resolve: CaseEventRequest = {
  action: CaseAction.Resolve,
  expectedSequence: 2,
  resolution: CaseResolution.PlanReviewed,
  note: NOTE,
};

describe('CaseActionsService.addCaseEvent allowed actions', () => {
  it.each([
    { name: 'claim', make: open, actor: advisor, body: claim(1), to: CaseStatus.InReview },
    {
      name: 'release',
      make: inReview,
      actor: advisor,
      body: { action: CaseAction.Release, expectedSequence: 2 },
      to: CaseStatus.Open,
    },
    { name: 'resolve', make: inReview, actor: advisor, body: resolve, to: CaseStatus.Resolved },
    {
      name: 'withdraw an open case',
      make: open,
      actor: studentActor,
      body: { action: CaseAction.Withdraw, expectedSequence: 1 },
      to: CaseStatus.Withdrawn,
    },
    {
      name: 'withdraw a case in review',
      make: inReview,
      actor: studentActor,
      body: { action: CaseAction.Withdraw, expectedSequence: 2 },
      to: CaseStatus.Withdrawn,
    },
  ])('$name leads to the status the ADR-0013 table gives', async (scenario) => {
    const { service, store, logger, caseId } = setup(scenario.make());

    const view = await service.addCaseEvent(
      scenario.actor,
      { caseId, body: scenario.body },
      { logger },
    );

    expect(view.status).toBe(scenario.to);
    expect(store.caseEvents.at(-1)).toMatchObject({ toStatus: scenario.to, at: NOW.toISOString() });
    expect(view.lastSequence).toBe(scenario.body.expectedSequence + 1);
  });

  it('claim makes the actor the owner, with no resolution or note on the event', async () => {
    const { service, store, logger, caseId } = setup(open());

    const view = await service.addCaseEvent(advisor, { caseId, body: claim(1) }, { logger });

    expect(view.owner).toEqual({ role: Role.Advisor, isYou: true });
    expect(store.caseEvents.at(-1)).toMatchObject({ resolution: null, note: null });
  });

  it('resolve records the resolution and the note on the one event it writes', async () => {
    const { service, store, logger, caseId } = setup(inReview());

    await service.addCaseEvent(advisor, { caseId, body: resolve }, { logger });

    expect(store.caseEvents.at(-1)).toMatchObject({
      action: CaseAction.Resolve,
      resolution: CaseResolution.PlanReviewed,
      note: NOTE,
      actorUserId: advisor.userId,
    });
    expect(store.caseEvents).toHaveLength(3);
  });

  it('logs IDs, action and statuses once, never the note', async () => {
    const { service, logger, caseId } = setup(inReview());

    await service.addCaseEvent(advisor, { caseId, body: resolve }, { logger });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries.at(-1)?.details).toMatchObject({
      action: CaseAction.Resolve,
      fromStatus: CaseStatus.InReview,
      toStatus: CaseStatus.Resolved,
      sequence: 3,
    });
    expect(JSON.stringify(logger.entries)).not.toContain(NOTE);
  });
});

describe('CaseActionsService.addCaseEvent refusals', () => {
  it('answers a missing case with NotFoundError', async () => {
    const { service, logger } = setup(open());

    await expect(
      service.addCaseEvent(
        advisor,
        { caseId: buildAdvisingCase({}, 9).id, body: claim(1) },
        { logger },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('answers an actor who may not see the student, such as a revoked assignment, with NotFoundError and writes nothing', async () => {
    const { service, store, logger, caseId } = setup(inReview(), () => false);

    await expect(
      service.addCaseEvent(advisor, { caseId, body: resolve }, { logger }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(store.caseEvents).toHaveLength(2);
  });

  it.each([
    { name: 'a student claiming', make: open, actor: studentActor, body: claim(1) },
    {
      name: 'a non-owner releasing',
      make: inReview,
      actor: otherAdvisor,
      body: { action: CaseAction.Release, expectedSequence: 2 },
    },
    { name: 'a non-owner resolving', make: inReview, actor: otherAdvisor, body: resolve },
    { name: 'the student resolving', make: inReview, actor: studentActor, body: resolve },
    {
      name: 'an advisor withdrawing',
      make: open,
      actor: advisor,
      body: { action: CaseAction.Withdraw, expectedSequence: 1 },
    },
    { name: 'resolving a case nobody claimed', make: open, actor: advisor, body: resolve },
  ])('answers $name with NotFoundError and writes nothing', async (scenario) => {
    const { service, store, logger, caseId } = setup(scenario.make());
    const before = store.caseEvents.length;

    await expect(
      service.addCaseEvent(scenario.actor, { caseId, body: scenario.body }, { logger }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(store.caseEvents).toHaveLength(before);
  });

  it('answers a stale expectedSequence with RevisionConflictError', async () => {
    const { service, store, logger, caseId } = setup(open());

    await expect(
      service.addCaseEvent(advisor, { caseId, body: claim(3) }, { logger }),
    ).rejects.toBeInstanceOf(RevisionConflictError);
    expect(store.caseEvents).toHaveLength(1);
  });

  it('gives the second of two claims from the same sequence a conflict, changing nothing', async () => {
    const { service, store, logger, caseId } = setup(open());
    await service.addCaseEvent(advisor, { caseId, body: claim(1) }, { logger });

    await expect(
      service.addCaseEvent(otherAdvisor, { caseId, body: claim(1) }, { logger }),
    ).rejects.toBeInstanceOf(RevisionConflictError);
    expect(store.cases[0]?.ownerUserId).toBe(advisor.userId);
    expect(store.caseEvents.filter((event) => event.action === CaseAction.Claim)).toHaveLength(1);
  });

  it.each([
    { status: 'SEQUENCE_CONFLICT', error: RevisionConflictError },
    { status: 'CASE_NOT_FOUND', error: NotFoundError },
  ] as const)('turns a repository $status into $error.name', async ({ status, error }) => {
    const { store, caseId, logger } = setup(open());
    const racing = createCaseActionsService({
      access: { canViewStudent: () => Promise.resolve(true) },
      cases: {
        ...createInMemoryCaseRepository(store),
        appendEvent: () => Promise.resolve({ status }),
      },
      students: { findById: () => Promise.resolve(student) },
      advisorAssignments: { findActive: () => Promise.resolve(buildAdvisorAssignment()) },
      caseViewer: { viewCase: () => Promise.reject(new Error('unused')) },
      now: () => NOW,
    });

    await expect(
      racing.addCaseEvent(advisor, { caseId, body: claim(1) }, { logger }),
    ).rejects.toBeInstanceOf(error);
  });

  it.each([
    {
      name: 'a student withdrawing a resolved case',
      actor: studentActor,
      action: CaseAction.Withdraw,
    },
    { name: 'the owner resolving it again', actor: advisor, action: CaseAction.Resolve },
    { name: 'another advisor claiming it', actor: otherAdvisor, action: CaseAction.Claim },
  ])('refuses $name with InvalidRequestError, changing nothing', async (scenario) => {
    const { service, store, logger, caseId } = setup(buildResolvedAdvisingCase({ studentId }));
    const body = {
      action: scenario.action,
      expectedSequence: 3,
      ...(scenario.action === CaseAction.Resolve
        ? { resolution: CaseResolution.PlanReviewed }
        : {}),
    } as CaseEventRequest;
    const before = store.caseEvents.length;

    await expect(
      service.addCaseEvent(scenario.actor, { caseId, body }, { logger }),
    ).rejects.toBeInstanceOf(InvalidRequestError);
    expect(store.caseEvents).toHaveLength(before);
  });
});
