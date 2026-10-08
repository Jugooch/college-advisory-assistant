/**
 * @file Data access for plans and their append-only revisions.
 * @module @caa/db/repositories/plan
 * @requirement FR-11
 * @requirement FR-02
 * @requirement NFR-01
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { and, desc, eq, type SQL } from 'drizzle-orm';

import {
  type InstitutionId,
  type Plan,
  type PlanId,
  PlanIdSchema,
  type PlanRevisionId,
  type StudentId,
} from '@caa/domain';

import type { Database } from '../client';
import { toPlan } from '../mappers/plan.mapper';
import { type StoredPlanRevision, toStoredPlanRevision } from '../mappers/plan-revision.mapper';
import { type PlanRow, planTable } from '../tables/plan.table';
import { type PlanRevisionRow, planRevisionTable } from '../tables/plan-revision.table';
import { studentTable } from '../tables/student.table';
import {
  appendPlanRevision,
  type AppendRevisionRequest,
  type AppendRevisionResult,
  type CreatePlanResult,
  createPlanWithRevision,
  type NewPlan,
  type NewPlanRevision,
} from './plan-writes.repository';

export type {
  AppendRevisionRequest,
  AppendRevisionResult,
  CreatePlanResult,
  NewPlan,
  NewPlanRevision,
};

/** A plan with its newest revision. */
export interface PlanWithLatestRevision {
  readonly plan: Plan;
  readonly latest: StoredPlanRevision;
}

/**
 * Reads and appends plans. Revisions are immutable, so there are no update or delete methods,
 * and the database refuses them too.
 */
export interface PlanRepository {
  /**
   * Creates a plan and its revision 1 in one transaction. Neither exists if either insert fails.
   *
   * @param tenantId - Tenant from the session; owns the plan.
   * @param plan - Student, term, and creation time.
   * @param firstRevision - The first revision's content.
   * @returns The new plan and revision, or `PLAN_EXISTS` when the student already has a plan
   *   for the term.
   * @throws {z.ZodError} When the stored rows fail the domain schemas.
   */
  createWithFirstRevision(
    tenantId: InstitutionId,
    plan: NewPlan,
    firstRevision: NewPlanRevision,
  ): Promise<CreatePlanResult>;

  /**
   * Appends revision `expectedRevision + 1`. The caller states the revision it saw, so a stale
   * caller never overwrites or skips a newer one (ADR-0011 pattern).
   *
   * @param tenantId - Tenant from the session; must own the plan.
   * @param planId - Plan to append to.
   * @param request - The latest revision number the caller saw, and the new revision's content.
   * @returns The appended revision, `REVISION_CONFLICT` when the latest revision isn't
   *   `expectedRevision` or a concurrent append took the number, or `PLAN_NOT_FOUND`.
   * @throws {z.ZodError} When the stored row fails the domain schema.
   */
  appendRevision(
    tenantId: InstitutionId,
    planId: PlanId,
    request: AppendRevisionRequest,
  ): Promise<AppendRevisionResult>;

  /**
   * Finds a plan.
   *
   * @param tenantId - Tenant from the session.
   * @param planId - Plan to find.
   * @returns The plan, or null when it is missing, another tenant's, or its student was deleted
   *   by the source.
   * @throws {z.ZodError} When the stored row fails the domain schema.
   */
  findPlan(tenantId: InstitutionId, planId: PlanId): Promise<Plan | null>;

  /**
   * Finds one revision of a plan.
   *
   * @param tenantId - Tenant from the session.
   * @param planId - Plan the revision belongs to.
   * @param revision - Revision number, or `'LATEST'` for the newest.
   * @returns The revision with its opaque result, or null when absent or not visible.
   * @throws {z.ZodError} When the stored row fails the domain schema.
   */
  findRevision(
    tenantId: InstitutionId,
    planId: PlanId,
    revision: number | 'LATEST',
  ): Promise<StoredPlanRevision | null>;

  /**
   * Finds one revision by its ID, without knowing the plan.
   *
   * @param tenantId - Tenant from the session.
   * @param revisionId - Revision to find.
   * @returns The revision with its opaque result, or null when absent, another tenant's, or its
   *   student was deleted by the source.
   * @throws {z.ZodError} When the stored row fails the domain schema.
   */
  // TODO(#440): make this required once the QA and api in-memory fakes implement it.
  findRevisionById?(
    tenantId: InstitutionId,
    revisionId: PlanRevisionId,
  ): Promise<StoredPlanRevision | null>;

  /**
   * Lists the student's plans, newest first, each with its newest revision.
   *
   * @param tenantId - Tenant from the session.
   * @param studentId - Student whose plans are wanted.
   * @returns The plans, empty when the student has none or belongs to another tenant.
   * @throws {z.ZodError} When a stored row fails the domain schema.
   */
  listForStudent(
    tenantId: InstitutionId,
    studentId: StudentId,
  ): Promise<readonly PlanWithLatestRevision[]>;
}

/**
 * Reads plans of students who aren't deleted by the source, newest first.
 *
 * @param db - Typed database handle.
 * @param tenantId - Tenant from the session.
 * @param filter - Extra condition, such as the plan or student wanted.
 * @returns The matching plan rows.
 */
async function readVisiblePlans(
  db: Database,
  tenantId: InstitutionId,
  filter: SQL,
): Promise<PlanRow[]> {
  const rows = await db
    .select({ plan: planTable })
    .from(planTable)
    .innerJoin(
      studentTable,
      and(eq(studentTable.tenantId, planTable.tenantId), eq(studentTable.id, planTable.studentId)),
    )
    // SECURITY: every read is filtered by tenant; a tombstoned student's plans are invisible.
    .where(and(eq(planTable.tenantId, tenantId), eq(studentTable.isDeleted, false), filter))
    .orderBy(desc(planTable.createdAt), desc(planTable.id));
  return rows.map((row) => row.plan);
}

/**
 * Reads one revision row of a plan.
 *
 * @param db - Typed database handle.
 * @param tenantId - Tenant from the session.
 * @param target - Plan the revision belongs to, and its number or `'LATEST'`.
 * @returns The row, or undefined when absent.
 */
async function readRevisionRow(
  db: Database,
  tenantId: InstitutionId,
  target: { readonly planId: PlanId; readonly revision: number | 'LATEST' },
): Promise<PlanRevisionRow | undefined> {
  const revisions = planRevisionTable;
  const rows = await db
    .select()
    .from(revisions)
    .where(
      and(
        eq(revisions.tenantId, tenantId),
        eq(revisions.planId, target.planId),
        target.revision === 'LATEST' ? undefined : eq(revisions.revision, target.revision),
      ),
    )
    .orderBy(desc(revisions.revision))
    .limit(1);
  return rows[0];
}

/**
 * Creates the plan repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link PlanRepository} that always implements `findRevisionById`.
 */
export function createPlanRepository(db: Database): PlanRepository & {
  readonly findRevisionById: NonNullable<PlanRepository['findRevisionById']>;
} {
  return {
    createWithFirstRevision: (tenantId, newPlan, firstRevision) =>
      createPlanWithRevision(db)(tenantId, newPlan, firstRevision),

    appendRevision: (tenantId, planId, request) =>
      appendPlanRevision(db)(tenantId, planId, request),

    async findPlan(tenantId, planId) {
      const [row] = await readVisiblePlans(db, tenantId, eq(planTable.id, planId));
      return row ? toPlan(row) : null;
    },

    async findRevision(tenantId, planId, revision) {
      const [plan] = await readVisiblePlans(db, tenantId, eq(planTable.id, planId));
      if (!plan) {
        return null;
      }
      const row = await readRevisionRow(db, tenantId, { planId, revision });
      return row ? toStoredPlanRevision(row) : null;
    },

    async findRevisionById(tenantId, revisionId) {
      const [row] = await db
        .select()
        .from(planRevisionTable)
        // SECURITY: filtered by tenant, so another tenant's revision ID finds nothing.
        .where(and(eq(planRevisionTable.tenantId, tenantId), eq(planRevisionTable.id, revisionId)));
      if (!row) {
        return null;
      }
      const [plan] = await readVisiblePlans(db, tenantId, eq(planTable.id, row.planId));
      return plan ? toStoredPlanRevision(row) : null;
    },

    async listForStudent(tenantId, studentId) {
      const rows = await readVisiblePlans(db, tenantId, eq(planTable.studentId, studentId));
      const found: PlanWithLatestRevision[] = [];
      for (const plan of rows) {
        const latest = await readRevisionRow(db, tenantId, {
          planId: PlanIdSchema.parse(plan.id),
          revision: 'LATEST',
        });
        if (latest) {
          found.push({ plan: toPlan(plan), latest: toStoredPlanRevision(latest) });
        }
      }
      return found;
    },
  };
}
