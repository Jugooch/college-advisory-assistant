/**
 * @file Advising case writes: the transactions behind the case repository's create and append.
 * @module @caa/db/repositories/advising-case-writes
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { and, eq } from 'drizzle-orm';

import {
  type AdvisingCase,
  CaseAction,
  type CaseEvent,
  type CaseId,
  type CaseReason,
  CaseStatus,
  type DiscrepancySubject,
  type InstitutionId,
  type PlanRevisionId,
  type StudentId,
  type UserId,
} from '@caa/domain';

import type { Database } from '../client';
import { toAdvisingCase } from '../mappers/advising-case.mapper';
import { toCaseEvent } from '../mappers/case-event.mapper';
import { advisingCaseTable } from '../tables/advising-case.table';
import { caseEventTable } from '../tables/case-event.table';
import { planRevisionTable } from '../tables/plan-revision.table';
import { studentTable } from '../tables/student.table';

/** The handle a transaction callback receives. */
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** The one-open-case-per-plan index (ADR-0013 §6). */
const ONE_OPEN_INDEX = 'advising_case_one_open_per_plan_idx';
/** The `(case_id, sequence)` key that backs the concurrency guard. */
const SEQUENCE_KEY = 'case_event_case_id_sequence_key';

/** A case to create. The repository assigns the ID, the status `OPEN`, and sequence 1. */
export interface NewAdvisingCase {
  readonly studentId: StudentId;
  readonly reason: CaseReason;
  /** The frozen revision under review; null only for a source discrepancy. */
  readonly planRevisionId: PlanRevisionId | null;
  readonly discrepancySubject: DiscrepancySubject | null;
  /** SECURITY: never logged and never put in an error. */
  readonly studentNote: string;
  /** The student creating the case; recorded on the CREATE event. */
  readonly actorUserId: UserId;
  /** ISO 8601 with offset, from the caller's clock. */
  readonly createdAt: string;
}

/** An event to append: what the actor did, and the status it leads to. */
export type NewCaseEvent = Pick<
  CaseEvent,
  'action' | 'actorUserId' | 'at' | 'toStatus' | 'resolution' | 'note'
>;

/** What an append states: the sequence the caller saw, and the event to add after it. */
export interface AppendCaseEventRequest {
  readonly expectedSequence: number;
  readonly event: NewCaseEvent;
}

/** Result of {@link AdvisingCaseRepository.create}. */
export type CreateCaseResult =
  | { readonly status: 'CREATED'; readonly case: AdvisingCase; readonly event: CaseEvent }
  | { readonly status: 'OPEN_CASE_EXISTS' }
  | { readonly status: 'STUDENT_NOT_FOUND' }
  | { readonly status: 'PLAN_REVISION_NOT_FOUND' };

/** Result of {@link AdvisingCaseRepository.appendEvent}. */
export type AppendCaseEventResult =
  | { readonly status: 'APPENDED'; readonly case: AdvisingCase; readonly event: CaseEvent }
  | { readonly status: 'SEQUENCE_CONFLICT' }
  | { readonly status: 'CASE_NOT_FOUND' };

/**
 * Returns whether an error is a unique-key violation of the named constraint or index. Drizzle
 * wraps the driver error as `cause`.
 *
 * @param error - Anything thrown by a query.
 * @param constraint - Constraint or unique index name from the table definition.
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
 * Fails a write whose `RETURNING` gave no row.
 *
 * @param what - Name of the row, for the message.
 * @returns Never.
 * @throws {Error} Always.
 */
function failInsert(what: string): never {
  throw new Error(`${what} insert returned no row`);
}

/**
 * Finds the plan of the revision a case will review.
 *
 * @param tx - Transaction handle.
 * @param tenantId - Tenant from the session.
 * @param newCase - The case being created.
 * @returns The plan ID, null for a case without a revision, or undefined when the revision
 *   isn't this student's in this tenant.
 */
async function findCasePlan(
  tx: Transaction,
  tenantId: InstitutionId,
  newCase: NewAdvisingCase,
): Promise<string | null | undefined> {
  if (newCase.planRevisionId === null) {
    return null;
  }
  const revisions = planRevisionTable;
  // SECURITY: the revision must be this tenant's and this student's; the foreign key re-checks it.
  const rows = await tx
    .select({ planId: revisions.planId })
    .from(revisions)
    .where(
      and(
        eq(revisions.tenantId, tenantId),
        eq(revisions.id, newCase.planRevisionId),
        eq(revisions.studentId, newCase.studentId),
      ),
    );
  return rows[0]?.planId;
}

/**
 * Inserts the OPEN case and its CREATE event.
 *
 * @param tx - Transaction handle.
 * @param tenantId - Tenant from the session; owns the case.
 * @param placement - The case being created, and the plan of its revision (null without one).
 * @returns The created case and event.
 */
async function insertCaseAndCreateEvent(
  tx: Transaction,
  tenantId: InstitutionId,
  placement: { readonly newCase: NewAdvisingCase; readonly planId: string | null },
): Promise<CreateCaseResult> {
  const { newCase, planId } = placement;
  const { actorUserId, createdAt, ...fields } = newCase;
  const caseRows = await tx
    .insert(advisingCaseTable)
    .values({
      ...fields,
      tenantId,
      planId,
      status: CaseStatus.Open,
      ownerUserId: null,
      createdAt: new Date(createdAt),
      lastSequence: 1,
    })
    .returning();
  const created = toAdvisingCase(caseRows[0] ?? failInsert('case'));
  const eventRows = await tx
    .insert(caseEventTable)
    .values({
      tenantId,
      caseId: created.id,
      sequence: 1,
      action: CaseAction.Create,
      actorUserId,
      at: new Date(createdAt),
      fromStatus: null,
      toStatus: CaseStatus.Open,
      resolution: null,
      note: null,
    })
    .returning();
  return {
    status: 'CREATED',
    case: created,
    event: toCaseEvent(eventRows[0] ?? failInsert('case event')),
  };
}

/**
 * Creates a case and its CREATE event in one transaction.
 *
 * @param db - Typed database handle, bound first so the returned function takes two arguments.
 * @param tenantId - Tenant from the session; owns the case.
 * @param newCase - The case to create.
 * @returns The case and event, or the reason nothing was created.
 */
export const createCaseWithEvent =
  (db: Database) =>
  async (tenantId: InstitutionId, newCase: NewAdvisingCase): Promise<CreateCaseResult> => {
    try {
      return await db.transaction(async (tx): Promise<CreateCaseResult> => {
        const students = await tx
          .select({ id: studentTable.id })
          .from(studentTable)
          .where(
            and(
              eq(studentTable.tenantId, tenantId),
              eq(studentTable.id, newCase.studentId),
              eq(studentTable.isDeleted, false),
            ),
          );
        if (!students[0]) {
          return { status: 'STUDENT_NOT_FOUND' };
        }
        const planId = await findCasePlan(tx, tenantId, newCase);
        if (planId === undefined) {
          return { status: 'PLAN_REVISION_NOT_FOUND' };
        }
        return insertCaseAndCreateEvent(tx, tenantId, { newCase, planId });
      });
    } catch (error) {
      if (isUniqueViolation(error, ONE_OPEN_INDEX)) {
        return { status: 'OPEN_CASE_EXISTS' };
      }
      throw error;
    }
  };

/**
 * Appends event `expectedSequence + 1` to a case and updates the case's state, in one
 * transaction.
 *
 * @param db - Typed database handle, bound first so the returned function takes three arguments.
 * @param tenantId - Tenant from the session; must own the case.
 * @param caseId - Case to append to.
 * @param request - The latest sequence the caller saw, and what the actor did.
 * @returns The updated case and the event, `SEQUENCE_CONFLICT`, or `CASE_NOT_FOUND`.
 */
export const appendCaseEvent =
  (db: Database) =>
  async (
    tenantId: InstitutionId,
    caseId: CaseId,
    { expectedSequence, event }: AppendCaseEventRequest,
  ): Promise<AppendCaseEventResult> => {
    try {
      return await db.transaction(async (tx): Promise<AppendCaseEventResult> => {
        // SECURITY: looked up by tenant, so another tenant's case is not found. The row lock
        // serializes appends to one case, so the sequence check below can't be raced.
        const rows = await tx
          .select()
          .from(advisingCaseTable)
          .where(and(eq(advisingCaseTable.tenantId, tenantId), eq(advisingCaseTable.id, caseId)))
          .for('update');
        const current = rows[0];
        if (!current) {
          return { status: 'CASE_NOT_FOUND' };
        }
        // SAFETY: only the next number after the one the caller saw is accepted, so a stale
        // caller can't act on a case that has since changed.
        if (current.lastSequence !== expectedSequence) {
          return { status: 'SEQUENCE_CONFLICT' };
        }
        const hasOwner =
          event.toStatus === CaseStatus.InReview || event.toStatus === CaseStatus.Resolved;
        const updated = await tx
          .update(advisingCaseTable)
          .set({
            status: event.toStatus,
            // NOTE: the claimant, or the resolver once resolved; none while open or withdrawn.
            ownerUserId: hasOwner ? event.actorUserId : null,
            lastSequence: expectedSequence + 1,
          })
          .where(and(eq(advisingCaseTable.tenantId, tenantId), eq(advisingCaseTable.id, caseId)))
          .returning();
        const inserted = await tx
          .insert(caseEventTable)
          .values({
            ...event,
            tenantId,
            caseId,
            sequence: expectedSequence + 1,
            at: new Date(event.at),
            fromStatus: current.status,
          })
          .returning();
        return {
          status: 'APPENDED',
          case: toAdvisingCase(updated[0] ?? failInsert('case')),
          event: toCaseEvent(inserted[0] ?? failInsert('case event')),
        };
      });
    } catch (error) {
      // NOTE: the lock makes this unreachable today; the unique key stays the backstop.
      if (isUniqueViolation(error, SEQUENCE_KEY)) {
        return { status: 'SEQUENCE_CONFLICT' };
      }
      throw error;
    }
  };
