/**
 * @file Plan writes: the transactions behind the plan repository's create and append.
 * @module @caa/db/repositories/plan-writes.repository
 * @requirement FR-11
 * @requirement NFR-01
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { and, eq, max } from 'drizzle-orm';

import type { InstitutionId, Plan, PlanId, PlanRevision, StudentId, TermId } from '@caa/domain';

import type { Database } from '../client';
import { toPlan } from '../mappers/plan.mapper';
import { type StoredPlanRevision, toStoredPlanRevision } from '../mappers/plan-revision.mapper';
import { planTable } from '../tables/plan.table';
import { planRevisionTable } from '../tables/plan-revision.table';

/**
 * A revision to append: everything except what the repository assigns (the ID, the plan, and
 * the number), with the schedule-options result as opaque JSON. `createdAt` is supplied by the
 * caller's clock.
 */
export type NewPlanRevision = Omit<PlanRevision, 'id' | 'planId' | 'revision'> & {
  readonly result: unknown;
};

/** The plan to create: the session student's, for one term, at the caller's clock time. */
export interface NewPlan {
  readonly studentId: StudentId;
  readonly termId: TermId;
  /** ISO 8601 with offset. */
  readonly createdAt: string;
}

/** What an append states: the revision the caller saw, and the content to add after it. */
export interface AppendRevisionRequest {
  readonly expectedRevision: number;
  readonly revision: NewPlanRevision;
}

/** Result of {@link PlanRepository.createWithFirstRevision}. */
export type CreatePlanResult =
  | { readonly status: 'CREATED'; readonly plan: Plan; readonly revision: StoredPlanRevision }
  | { readonly status: 'PLAN_EXISTS' };

/** Result of {@link PlanRepository.appendRevision}. */
export type AppendRevisionResult =
  | { readonly status: 'APPENDED'; readonly revision: StoredPlanRevision }
  | { readonly status: 'REVISION_CONFLICT' }
  | { readonly status: 'PLAN_NOT_FOUND' };

/** Insert values for a revision. */
type RevisionInsert = typeof planRevisionTable.$inferInsert;

/**
 * Returns whether an error is a unique-key violation of the named constraint. Drizzle wraps the
 * driver error as `cause`.
 *
 * @param error - Anything thrown by a query.
 * @param constraint - Constraint name from the table definition.
 * @returns `true` for SQLSTATE 23505 on that constraint.
 */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === '23505' &&
    'constraint' in cause &&
    cause.constraint === constraint
  );
}

/**
 * Builds the revision row to insert.
 *
 * @param plan - The plan the revision belongs to.
 * @param revisionNumber - Number to assign.
 * @param revision - The revision's content.
 * @returns Insert values; the foreign keys hold the student and term equal to the plan's.
 */
function toRevisionValues(
  plan: Plan,
  revisionNumber: number,
  revision: NewPlanRevision,
): RevisionInsert {
  return {
    ...revision,
    tenantId: plan.tenantId,
    planId: plan.id,
    studentId: plan.studentId,
    termId: plan.termId,
    revision: revisionNumber,
    createdAt: new Date(revision.createdAt),
    courseIds: [...revision.courseIds],
    studentRecordEffectiveAt: new Date(revision.studentRecordEffectiveAt),
    auditRecordEffectiveAt: new Date(revision.auditRecordEffectiveAt),
    selectedSectionIds: revision.selectedSectionIds ? [...revision.selectedSectionIds] : null,
  };
}

/**
 * Creates a plan and its revision 1 in one transaction.
 *
 * @param db - Typed database handle, bound first so the returned function takes three arguments.
 * @param tenantId - Tenant from the session; owns the plan.
 * @param newPlan - Student, term, and creation time.
 * @param firstRevision - The first revision's content.
 * @returns The new plan and revision, or `PLAN_EXISTS` when the term already has a plan.
 */
export const createPlanWithRevision =
  (db: Database) =>
  async (
    tenantId: InstitutionId,
    newPlan: NewPlan,
    firstRevision: NewPlanRevision,
  ): Promise<CreatePlanResult> => {
    try {
      return await db.transaction(async (tx) => {
        const planRows = await tx
          .insert(planTable)
          .values({ ...newPlan, tenantId, createdAt: new Date(newPlan.createdAt) })
          .returning();
        const plan = toPlan(planRows[0] ?? failInsert('plan'));
        const revisionRows = await tx
          .insert(planRevisionTable)
          .values(toRevisionValues(plan, 1, firstRevision))
          .returning();
        const revision = toStoredPlanRevision(revisionRows[0] ?? failInsert('plan revision'));
        return { status: 'CREATED', plan, revision };
      });
    } catch (error) {
      if (isUniqueViolation(error, 'plan_tenant_student_term_key')) {
        return { status: 'PLAN_EXISTS' };
      }
      throw error;
    }
  };

/**
 * Appends revision `expectedRevision + 1` to a plan in one transaction.
 *
 * @param db - Typed database handle, bound first so the returned function takes three arguments.
 * @param tenantId - Tenant from the session; must own the plan.
 * @param planId - Plan to append to.
 * @param request - The revision the caller saw, and the content to add.
 * @returns The appended revision, `REVISION_CONFLICT`, or `PLAN_NOT_FOUND`.
 */
export const appendPlanRevision =
  (db: Database) =>
  async (
    tenantId: InstitutionId,
    planId: PlanId,
    request: AppendRevisionRequest,
  ): Promise<AppendRevisionResult> => {
    try {
      return await db.transaction(async (tx) => {
        // SECURITY: the plan is looked up by tenant, so another tenant's plan is not found.
        // The row lock serializes appends to one plan, so the check below can't be raced.
        const planRows = await tx
          .select()
          .from(planTable)
          .where(and(eq(planTable.tenantId, tenantId), eq(planTable.id, planId)))
          .for('update');
        if (!planRows[0]) {
          return { status: 'PLAN_NOT_FOUND' };
        }
        const [latest] = await tx
          .select({ value: max(planRevisionTable.revision) })
          .from(planRevisionTable)
          .where(
            and(eq(planRevisionTable.tenantId, tenantId), eq(planRevisionTable.planId, planId)),
          );
        // SAFETY: only the next number after the one the caller saw is accepted, so a stale
        // caller can't overwrite, skip, or leave a gap in the history.
        if ((latest?.value ?? 0) !== request.expectedRevision) {
          return { status: 'REVISION_CONFLICT' };
        }
        const values = toRevisionValues(
          toPlan(planRows[0]),
          request.expectedRevision + 1,
          request.revision,
        );
        const rows = await tx.insert(planRevisionTable).values(values).returning();
        return {
          status: 'APPENDED',
          revision: toStoredPlanRevision(rows[0] ?? failInsert('plan revision')),
        };
      });
    } catch (error) {
      // NOTE: the lock makes this unreachable today; the unique key stays the backstop.
      if (isUniqueViolation(error, 'plan_revision_plan_revision_key')) {
        return { status: 'REVISION_CONFLICT' };
      }
      throw error;
    }
  };

/**
 * Fails a write whose `RETURNING` gave no row.
 *
 * @param what - Name of the row, for the message.
 * @returns Never.
 * @throws {Error} Always.
 */
function failInsert(what: string): never {
  throw new Error(`${what} insert returned no row`);
}
