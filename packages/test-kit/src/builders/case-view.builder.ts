/**
 * @file Builds synthetic case views, case event views and queue rows in the #404 contract
 *   shape. Actors are a role plus `isYou`, never a user ID. The builders parse their result
 *   with the contract schema, so an event chain that doesn't fit the status fails where built.
 * @module @caa/test-kit/builders/case-view
 */
import type { z } from 'zod';

import {
  type CaseEventView,
  CaseEventViewSchema,
  CaseQueueItemSchema,
  type CaseView,
  CaseViewSchema,
} from '@caa/api-contract';
import {
  CaseAction,
  CaseReason,
  CaseResolution,
  CaseStatus,
  DiscrepancySubject,
  Role,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { buildPlanRevisionView } from './plan-revision-view.builder';

/** Raw input accepted for a case event view, as the contract schema reads it. */
export type CaseEventViewInput = z.input<typeof CaseEventViewSchema>;

/** Raw input accepted for a case view, as the contract schema reads it. */
export type CaseViewInput = z.input<typeof CaseViewSchema>;

/**
 * Builds a valid CREATE event view (sequence 1) made by the signed-in student.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes events; drives the default `id`.
 * @returns The event view, parsed by the contract.
 */
export function buildCaseEventView(
  overrides: Partial<CaseEventViewInput> = {},
  seed = 1,
): CaseEventView {
  return CaseEventViewSchema.parse({
    id: syntheticId('caseEvent', seed),
    sequence: 1,
    action: CaseAction.Create,
    actorRole: Role.Student,
    isYou: true,
    at: '2026-09-22T10:00:00.000-05:00',
    fromStatus: null,
    toStatus: CaseStatus.Open,
    resolution: null,
    note: null,
    ...overrides,
  });
}

/**
 * Builds a CLAIM event view (sequence 2) by an advisor, moving `OPEN` to `IN_REVIEW`.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes events; drives the default `id`.
 * @returns The event view, parsed by the contract.
 */
export function buildClaimCaseEventView(
  overrides: Partial<CaseEventViewInput> = {},
  seed = 2,
): CaseEventView {
  return buildCaseEventView(
    {
      sequence: 2,
      action: CaseAction.Claim,
      actorRole: Role.Advisor,
      isYou: false,
      at: '2026-09-22T11:00:00.000-05:00',
      fromStatus: CaseStatus.Open,
      toStatus: CaseStatus.InReview,
      ...overrides,
    },
    seed,
  );
}

/**
 * Builds a RESOLVE event view (sequence 3) by an advisor, with a resolution and note.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes events; drives the default `id`.
 * @returns The event view, parsed by the contract.
 */
export function buildResolveCaseEventView(
  overrides: Partial<CaseEventViewInput> = {},
  seed = 3,
): CaseEventView {
  return buildCaseEventView(
    {
      sequence: 3,
      action: CaseAction.Resolve,
      actorRole: Role.Advisor,
      isYou: false,
      at: '2026-09-22T12:00:00.000-05:00',
      fromStatus: CaseStatus.InReview,
      toStatus: CaseStatus.Resolved,
      resolution: CaseResolution.PlanReviewed,
      note: 'Reviewed the plan with the student.',
      ...overrides,
    },
    seed,
  );
}

/**
 * Builds a valid `OPEN` plan-review case view as the student who made it sees it: one CREATE
 * event, no owner, and a frozen `context` (the default revision view with `CURRENT` freshness)
 * whose ID is `planRevisionId`. `allowedActions` is empty, since the student can take none.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes cases; drives the default `id`.
 * @returns The case view, parsed by the contract.
 */
export function buildCaseView(overrides: Partial<CaseViewInput> = {}, seed = 1): CaseView {
  const context = overrides.context === undefined ? buildPlanRevisionView() : overrides.context;
  return CaseViewSchema.parse({
    id: syntheticId('advisingCase', seed),
    studentId: syntheticId('student', 1),
    reason: CaseReason.PlanReview,
    planRevisionId: context?.id ?? null,
    discrepancySubject: null,
    studentNote: 'Please check this plan before I register.',
    status: CaseStatus.Open,
    owner: null,
    createdAt: '2026-09-22T10:00:00.000-05:00',
    lastSequence: 1,
    events: [buildCaseEventView({}, seed * 10 + 1)],
    context,
    allowedActions: [],
    ...overrides,
  });
}

/**
 * Builds an `IN_REVIEW` case view as the claiming advisor sees it: CREATE by the student then
 * CLAIM by the viewer, who owns the case and may release or resolve it.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes cases; drives the default `id`.
 * @returns The case view, parsed by the contract.
 */
export function buildInReviewCaseView(overrides: Partial<CaseViewInput> = {}, seed = 1): CaseView {
  return buildCaseView(
    {
      status: CaseStatus.InReview,
      owner: { role: Role.Advisor, isYou: true },
      lastSequence: 2,
      events: [
        buildCaseEventView({ isYou: false }, seed * 10 + 1),
        buildClaimCaseEventView({ isYou: true }, seed * 10 + 2),
      ],
      allowedActions: [CaseAction.Release, CaseAction.Resolve],
      ...overrides,
    },
    seed,
  );
}

/**
 * Builds a `RESOLVED` case view as the resolving advisor sees it: CREATE, CLAIM, then RESOLVE by
 * the viewer. No action is allowed on a resolved case.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes cases; drives the default `id`.
 * @returns The case view, parsed by the contract.
 */
export function buildResolvedCaseView(overrides: Partial<CaseViewInput> = {}, seed = 1): CaseView {
  return buildCaseView(
    {
      status: CaseStatus.Resolved,
      owner: { role: Role.Advisor, isYou: true },
      lastSequence: 3,
      events: [
        buildCaseEventView({ isYou: false }, seed * 10 + 1),
        buildClaimCaseEventView({ isYou: true }, seed * 10 + 2),
        buildResolveCaseEventView({ isYou: true }, seed * 10 + 3),
      ],
      allowedActions: [],
      ...overrides,
    },
    seed,
  );
}

/**
 * Builds an `OPEN` source-discrepancy case view: no plan revision, no `context`, and a subject.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes cases; drives the default `id`.
 * @returns The case view, parsed by the contract.
 */
export function buildSourceDiscrepancyCaseView(
  overrides: Partial<CaseViewInput> = {},
  seed = 1,
): CaseView {
  return buildCaseView(
    {
      reason: CaseReason.SourceDiscrepancy,
      planRevisionId: null,
      discrepancySubject: DiscrepancySubject.AuditRequirement,
      context: null,
      ...overrides,
    },
    seed,
  );
}

/** A queue row, as the contract schema parses it. */
export type CaseQueueItem = z.infer<typeof CaseQueueItemSchema>;

/** Raw input accepted for a queue row, as the contract schema reads it. */
export type CaseQueueItemInput = z.input<typeof CaseQueueItemSchema>;

/**
 * Builds a routed `OPEN` queue row for student 1 that the viewer does not own.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes cases; drives the default `caseId`.
 * @returns The queue row, parsed by the contract.
 */
export function buildCaseQueueItem(
  overrides: Partial<CaseQueueItemInput> = {},
  seed = 1,
): CaseQueueItem {
  return CaseQueueItemSchema.parse({
    caseId: syntheticId('advisingCase', seed),
    studentId: syntheticId('student', 1),
    reason: CaseReason.PlanReview,
    status: CaseStatus.Open,
    createdAt: '2026-09-22T10:00:00.000-05:00',
    ownerIsYou: false,
    routed: true,
    ...overrides,
  });
}

/**
 * Builds an unrouted queue row: the student has no active advisor assignment, so only admins
 * see it.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes cases; drives the default `caseId`.
 * @returns The queue row, parsed by the contract.
 */
export function buildUnroutedCaseQueueItem(
  overrides: Partial<CaseQueueItemInput> = {},
  seed = 1,
): CaseQueueItem {
  return buildCaseQueueItem({ routed: false, ...overrides }, seed);
}
