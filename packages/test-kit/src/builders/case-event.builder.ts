/**
 * @file Builds synthetic advising case events for tests.
 * @module @caa/test-kit/builders/case-event
 */
import {
  CaseAction,
  type CaseEvent,
  type CaseEventInput,
  CaseResolution,
  CaseStatus,
  createCaseEvent,
  Role,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';

/**
 * Builds a valid CREATE event (sequence 1) for case seed 1, made by student user 1.
 * `actorRole` defaults to `STUDENT`.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes events; drives the default `id`.
 * @returns A validated case event.
 */
export function buildCaseEvent(overrides: Partial<CaseEventInput> = {}, seed = 1): CaseEvent {
  return createCaseEvent({
    id: syntheticId('caseEvent', seed),
    caseId: syntheticId('advisingCase', 1),
    sequence: 1,
    action: CaseAction.Create,
    actorUserId: syntheticId('user', 1),
    actorRole: Role.Student,
    at: '2026-09-22T10:00:00.000-05:00',
    fromStatus: null,
    toStatus: CaseStatus.Open,
    resolution: null,
    note: null,
    ...overrides,
  });
}

/**
 * Builds the event history of an `IN_REVIEW` case: CREATE then CLAIM by advisor user 2
 * (`actorRole` `ADVISOR`).
 *
 * @param caseSeed - Seed of the case the events belong to.
 * @returns Two events in sequence order, each starting from the previous one's status.
 */
export function buildInReviewCaseEvents(caseSeed = 1): readonly CaseEvent[] {
  const caseId = syntheticId('advisingCase', caseSeed);
  return [
    buildCaseEvent({ caseId }, caseSeed * 10 + 1),
    buildCaseEvent(
      {
        caseId,
        sequence: 2,
        action: CaseAction.Claim,
        actorUserId: syntheticId('user', 2),
        actorRole: Role.Advisor,
        at: '2026-09-22T11:00:00.000-05:00',
        fromStatus: CaseStatus.Open,
        toStatus: CaseStatus.InReview,
      },
      caseSeed * 10 + 2,
    ),
  ];
}

/**
 * Builds the event history of a `RESOLVED` case: CREATE, CLAIM, then RESOLVE with a resolution
 * and note by advisor user 2.
 *
 * @param caseSeed - Seed of the case the events belong to.
 * @returns Three events in sequence order, each starting from the previous one's status.
 */
export function buildResolvedCaseEvents(caseSeed = 1): readonly CaseEvent[] {
  return [
    ...buildInReviewCaseEvents(caseSeed),
    buildCaseEvent(
      {
        caseId: syntheticId('advisingCase', caseSeed),
        sequence: 3,
        action: CaseAction.Resolve,
        actorUserId: syntheticId('user', 2),
        actorRole: Role.Advisor,
        at: '2026-09-22T12:00:00.000-05:00',
        fromStatus: CaseStatus.InReview,
        toStatus: CaseStatus.Resolved,
        resolution: CaseResolution.PlanReviewed,
        note: 'Reviewed the plan with the student.',
      },
      caseSeed * 10 + 3,
    ),
  ];
}
