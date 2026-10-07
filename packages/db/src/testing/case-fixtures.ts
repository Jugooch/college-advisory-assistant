/**
 * @file Synthetic cases and events for repository integration tests. Test code only; every
 *   value is fictional. Built from the shared test-kit builders, pointed at the real rows
 *   inserted here.
 * @module @caa/db/testing/case-fixtures
 * @see docs/standards/07-testing.md
 */
import {
  CaseAction,
  CaseResolution,
  CaseStatus,
  type InstitutionId,
  type PlanRevisionId,
  PlanRevisionIdSchema,
  type UserId,
} from '@caa/domain';
import { buildAdvisingCase, buildCaseEvent } from '@caa/test-kit';

import type { Database } from '../client';
import type { NewAdvisingCase, NewCaseEvent } from '../repositories/advising-case.repository';
import { createPlanRepository } from '../repositories/plan.repository';
import { advisorAssignmentTable } from '../tables/advisor-assignment.table';
import { buildNewRevision, insertPlanWorld, type PlanWorld } from './plan-fixtures';

/** A plan world with a saved plan, so a case can review its revision. */
export interface CaseWorld extends PlanWorld {
  readonly planRevisionId: PlanRevisionId;
}

/**
 * Inserts a plan world and saves its plan, giving a revision a case can review.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @param label - Distinguishes worlds in one tenant.
 * @returns The world and the saved revision's ID.
 */
export async function insertCaseWorld(
  db: Database,
  tenantId: InstitutionId,
  label: string,
): Promise<CaseWorld> {
  const world = await insertPlanWorld(db, tenantId, label);
  const created = await createPlanRepository(db).createWithFirstRevision(
    tenantId,
    { studentId: world.studentId, termId: world.termId, createdAt: '2026-10-01T15:00:00.000Z' },
    buildNewRevision(world),
  );
  if (created.status !== 'CREATED') {
    throw new Error('expected the plan to be created');
  }
  return { ...world, planRevisionId: PlanRevisionIdSchema.parse(created.revision.revision.id) };
}

/**
 * Builds a plan-review case for the world, from the shared builder's default fields.
 *
 * @param world - Student and revision to review.
 * @param overrides - Fields to change.
 * @returns The case to create, by the world's user.
 */
export function buildNewCase(
  world: CaseWorld,
  overrides: Partial<NewAdvisingCase> = {},
): NewAdvisingCase {
  const built = buildAdvisingCase();
  return {
    studentId: world.studentId,
    reason: built.reason,
    planRevisionId: world.planRevisionId,
    discrepancySubject: null,
    studentNote: built.studentNote,
    actorUserId: world.userId,
    createdAt: built.createdAt,
    ...overrides,
  };
}

/**
 * Builds a CLAIM event.
 *
 * @param actorUserId - The claiming advisor.
 * @returns The event to append.
 */
export function buildClaim(actorUserId: UserId): NewCaseEvent {
  const built = buildCaseEvent({
    sequence: 2,
    action: CaseAction.Claim,
    fromStatus: CaseStatus.Open,
    toStatus: CaseStatus.InReview,
    actorUserId,
  });
  return {
    action: built.action,
    actorUserId,
    at: built.at,
    toStatus: built.toStatus,
    resolution: null,
    note: null,
  };
}

/**
 * Builds a RESOLVE event.
 *
 * @param actorUserId - The resolving owner.
 * @returns The event to append.
 */
export function buildResolve(actorUserId: UserId): NewCaseEvent {
  return {
    ...buildClaim(actorUserId),
    action: CaseAction.Resolve,
    toStatus: CaseStatus.Resolved,
    resolution: CaseResolution.PlanReviewed,
    note: 'Reviewed the plan with the student.',
  };
}

/**
 * Assigns an advisor to a student for a period.
 *
 * @param db - Database handle.
 * @param assignment - Tenant, advisor, student, approver and the effective range.
 * @returns Nothing.
 */
export async function insertAssignment(
  db: Database,
  assignment: {
    readonly tenantId: InstitutionId;
    readonly advisorUserId: UserId;
    readonly studentId: PlanWorld['studentId'];
    readonly approvedBy: UserId;
    readonly effectiveFrom: string;
    readonly effectiveTo: string | null;
  },
): Promise<void> {
  await db.insert(advisorAssignmentTable).values({
    ...assignment,
    effectiveFrom: new Date(assignment.effectiveFrom),
    effectiveTo: assignment.effectiveTo === null ? null : new Date(assignment.effectiveTo),
  });
}
