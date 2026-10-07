/**
 * @file Data access for advising cases, their append-only events, and the advisor queue.
 * @module @caa/db/repositories/advising-case
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  isNull,
  lte,
  notExists,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

import {
  type AdvisingCase,
  type CaseEvent,
  type CaseId,
  CaseStatus,
  type InstitutionId,
  type StudentId,
  type UserId,
} from '@caa/domain';

import type { Database } from '../client';
import { toAdvisingCase } from '../mappers/advising-case.mapper';
import { toCaseEvent } from '../mappers/case-event.mapper';
import { advisingCaseTable } from '../tables/advising-case.table';
import { advisorAssignmentTable } from '../tables/advisor-assignment.table';
import { caseEventTable } from '../tables/case-event.table';
import { studentTable } from '../tables/student.table';
import {
  appendCaseEvent,
  type AppendCaseEventRequest,
  type AppendCaseEventResult,
  type CreateCaseResult,
  createCaseWithEvent,
  type NewAdvisingCase,
  type NewCaseEvent,
} from './advising-case-writes.repository';

export type {
  AppendCaseEventRequest,
  AppendCaseEventResult,
  CreateCaseResult,
  NewAdvisingCase,
  NewCaseEvent,
};

/** What {@link AdvisingCaseRepository.listQueue} filters on. */
export interface QueueQuery {
  /** ISO 8601 with offset; comes from an injected clock. */
  readonly at: string;
  /** Only cases in this status, or all when omitted. */
  readonly status?: CaseStatus;
}

/**
 * Reads and appends advising cases. A case changes only by appending an event, and events are
 * never updated or deleted, so there are no such methods and the database refuses them too.
 * Note text is stored but never appears in a log line or an error from this package.
 */
export interface AdvisingCaseRepository {
  /**
   * Creates a case and its CREATE event in one transaction. Neither exists if either insert
   * fails.
   *
   * @param tenantId - Tenant from the session; owns the case.
   * @param newCase - The case to create.
   * @returns The case and event; `OPEN_CASE_EXISTS` when the plan already has an open or
   *   in-review case; `STUDENT_NOT_FOUND`; or `PLAN_REVISION_NOT_FOUND` when the revision isn't
   *   this student's in this tenant.
   * @throws {z.ZodError} When the stored rows fail the domain schemas.
   */
  create(tenantId: InstitutionId, newCase: NewAdvisingCase): Promise<CreateCaseResult>;

  /**
   * Appends event `expectedSequence + 1` and updates the case's status and owner in one
   * transaction. The caller states the sequence it saw, so two actors racing from the same
   * sequence get one `APPENDED` and one `SEQUENCE_CONFLICT`. Which transitions are allowed is
   * the api's rule (ADR-0013 §6), not checked here.
   *
   * @param tenantId - Tenant from the session; must own the case.
   * @param caseId - Case to append to.
   * @param request - The latest sequence the caller saw, and what the actor did.
   * @returns The updated case and the event, `SEQUENCE_CONFLICT`, or `CASE_NOT_FOUND`.
   * @throws {z.ZodError} When the stored rows fail the domain schemas.
   */
  appendEvent(
    tenantId: InstitutionId,
    caseId: CaseId,
    request: AppendCaseEventRequest,
  ): Promise<AppendCaseEventResult>;

  /**
   * Finds a case.
   *
   * @param tenantId - Tenant from the session.
   * @param caseId - Case to find.
   * @returns The case, or null when missing, another tenant's, or its student was deleted by
   *   the source.
   * @throws {z.ZodError} When the stored row fails the domain schema.
   */
  findById(tenantId: InstitutionId, caseId: CaseId): Promise<AdvisingCase | null>;

  /**
   * Lists a case's events, oldest first.
   *
   * @param tenantId - Tenant from the session.
   * @param caseId - Case whose history is wanted.
   * @returns The events; empty when the case is missing, another tenant's, or not visible.
   * @throws {z.ZodError} When a stored row fails the domain schema.
   */
  listEvents(tenantId: InstitutionId, caseId: CaseId): Promise<readonly CaseEvent[]>;

  /**
   * Lists a student's cases, newest first.
   *
   * @param tenantId - Tenant from the session.
   * @param studentId - Student whose cases are wanted.
   * @returns The cases; empty for another tenant's student.
   * @throws {z.ZodError} When a stored row fails the domain schema.
   */
  listForStudent(tenantId: InstitutionId, studentId: StudentId): Promise<readonly AdvisingCase[]>;

  /**
   * Lists the cases of students the advisor holds an active assignment to at `at`, oldest
   * first. The join is in SQL; a case of any other student is never read.
   *
   * @param tenantId - Tenant from the session.
   * @param advisorUserId - Advisor from the session.
   * @param query - The instant to evaluate assignments at (ISO 8601 with offset, from an
   *   injected clock), and optionally only cases in one status.
   * @returns The advisor's queue.
   * @throws {RangeError} When `at` is not a valid date-time.
   * @throws {z.ZodError} When a stored row fails the domain schema.
   */
  listQueue(
    tenantId: InstitutionId,
    advisorUserId: UserId,
    query: QueueQuery,
  ): Promise<readonly AdvisingCase[]>;

  /**
   * Lists the tenant's OPEN cases whose student has no active assignment at `at`, oldest first,
   * so every student has a human route. For admins.
   *
   * @param tenantId - Tenant from the session.
   * @param at - Instant to evaluate assignments at (ISO 8601 with offset), from an injected clock.
   * @returns The unrouted cases.
   * @throws {RangeError} When `at` is not a valid date-time.
   * @throws {z.ZodError} When a stored row fails the domain schema.
   */
  listUnrouted(tenantId: InstitutionId, at: string): Promise<readonly AdvisingCase[]>;
}

/**
 * Parses an instant, refusing an invalid one.
 *
 * @param at - ISO 8601 date-time.
 * @returns The date.
 * @throws {RangeError} When `at` is not a valid date-time.
 */
function parseInstant(at: string): Date {
  const instant = new Date(at);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('an assignment query requires a valid ISO 8601 instant');
  }
  return instant;
}

/**
 * Builds the subquery for an assignment that is active at the instant for the case's student.
 * Start is inclusive and end is exclusive, so access ends exactly at `effectiveTo`.
 *
 * @param db - Typed database handle.
 * @param instant - Instant to evaluate at.
 * @param advisorUserId - Restrict to this advisor, or any advisor when omitted.
 * @returns A subquery correlated to `advising_case`.
 */
function activeAssignment(db: Database, instant: Date, advisorUserId?: UserId) {
  const assignments = advisorAssignmentTable;
  return db
    .select({ one: sql`1` })
    .from(assignments)
    .where(
      and(
        // SECURITY: tenant and student come from the case row, so no other student's assignment counts.
        eq(assignments.tenantId, advisingCaseTable.tenantId),
        eq(assignments.studentId, advisingCaseTable.studentId),
        advisorUserId === undefined ? undefined : eq(assignments.advisorUserId, advisorUserId),
        lte(assignments.effectiveFrom, instant),
        or(isNull(assignments.effectiveTo), gt(assignments.effectiveTo, instant)),
      ),
    );
}

/**
 * Reads cases of students who aren't deleted by the source.
 *
 * @param db - Typed database handle.
 * @param tenantId - Tenant from the session.
 * @param filter - Extra condition, such as the case, student or queue wanted, and whether to
 *   order newest first instead of oldest first.
 * @returns The matching cases.
 */
async function readCases(
  db: Database,
  tenantId: InstitutionId,
  filter: { readonly where?: SQL | undefined; readonly newestFirst?: boolean },
): Promise<AdvisingCase[]> {
  const cases = advisingCaseTable;
  const rows = await db
    .select({ row: cases })
    .from(cases)
    .innerJoin(
      studentTable,
      and(eq(studentTable.tenantId, cases.tenantId), eq(studentTable.id, cases.studentId)),
    )
    // SECURITY: every read is filtered by tenant; a tombstoned student's cases are invisible.
    .where(and(eq(cases.tenantId, tenantId), eq(studentTable.isDeleted, false), filter.where))
    .orderBy(
      filter.newestFirst === true ? desc(cases.createdAt) : asc(cases.createdAt),
      asc(cases.id),
    );
  return rows.map((entry) => toAdvisingCase(entry.row));
}

/**
 * Creates the advising case repository.
 *
 * @param db - Typed database handle.
 * @returns An {@link AdvisingCaseRepository}.
 */
export function createAdvisingCaseRepository(db: Database): AdvisingCaseRepository {
  const cases = advisingCaseTable;
  return {
    create: createCaseWithEvent(db),
    appendEvent: appendCaseEvent(db),

    async findById(tenantId, caseId) {
      const found = await readCases(db, tenantId, { where: eq(cases.id, caseId) });
      return found[0] ?? null;
    },

    async listEvents(tenantId, caseId) {
      const visible = await readCases(db, tenantId, { where: eq(cases.id, caseId) });
      if (!visible[0]) {
        return [];
      }
      const rows = await db
        .select()
        .from(caseEventTable)
        .where(and(eq(caseEventTable.tenantId, tenantId), eq(caseEventTable.caseId, caseId)))
        .orderBy(asc(caseEventTable.sequence));
      return rows.map(toCaseEvent);
    },

    listForStudent: (tenantId, studentId) =>
      readCases(db, tenantId, { where: eq(cases.studentId, studentId), newestFirst: true }),

    listQueue(tenantId, advisorUserId, { at, status }) {
      const instant = parseInstant(at);
      return readCases(db, tenantId, {
        where: and(
          exists(activeAssignment(db, instant, advisorUserId)),
          status === undefined ? undefined : eq(cases.status, status),
        ),
      });
    },

    listUnrouted(tenantId, at) {
      const instant = parseInstant(at);
      return readCases(db, tenantId, {
        where: and(eq(cases.status, CaseStatus.Open), notExists(activeAssignment(db, instant))),
      });
    },
  };
}
