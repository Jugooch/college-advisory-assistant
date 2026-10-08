/**
 * @file QA-owned in-memory advising case repository for the API acceptance harness. It follows
 * the documented `@caa/db` repository contract (tenant filter, one open or in-review case per
 * plan, `expectedSequence` conflicts, owner derived from the new status, append-only events,
 * assignment-scoped queue), written here from that contract and not copied from anyone's fakes,
 * so the acceptance oracle stays independent of the code under test.
 * @module @caa/tests/support/case-repositories
 * @requirement FR-14
 * @see docs/standards/07-testing.md
 */
import type {
  AdvisingCaseRepository,
  AppendCaseEventRequest,
  AppendCaseEventResult,
  CreateCaseResult,
  NewAdvisingCase,
} from '@caa/db';
import {
  type AdvisingCase,
  type AdvisorAssignment,
  CaseAction,
  type CaseEvent,
  CaseStatus,
  createAdvisingCase,
  createCaseEvent,
  type Student,
} from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import type { PlanWorld } from './plan-repositories';

/** Case backing data. A field that is omitted means nothing of that kind is stored. */
export interface CaseWorld extends PlanWorld {
  /** Students, read to refuse a case for an unknown student. */
  students?: readonly Student[];
  /** Advisor assignments, read to scope the queue. */
  assignments?: readonly AdvisorAssignment[];
  /** Cases of every tenant. */
  cases?: readonly AdvisingCase[];
  /** Every event of every case, oldest first. */
  caseEvents?: readonly CaseEvent[];
}

/** The case repository the harness gives the API's `Repositories` under the `cases` key. */
export interface CaseRepositories {
  readonly cases: AdvisingCaseRepository;
}

/**
 * Tells whether a case still holds its plan's single slot.
 *
 * @param status - The case's status.
 * @returns True for OPEN and IN_REVIEW.
 */
function isLive(status: CaseStatus): boolean {
  return status === CaseStatus.Open || status === CaseStatus.InReview;
}

/**
 * Tells whether the assignment is active at the instant. Start is inclusive and end exclusive.
 *
 * @param assignment - The assignment.
 * @param at - ISO 8601 instant.
 * @returns True when active.
 */
function isActiveAt(assignment: AdvisorAssignment, at: string): boolean {
  return (
    Date.parse(assignment.effectiveFrom) <= Date.parse(at) &&
    (assignment.effectiveTo === null || Date.parse(assignment.effectiveTo) > Date.parse(at))
  );
}

/**
 * Parses an instant, refusing an invalid one as the real repository does.
 *
 * @param at - ISO 8601 date-time.
 * @returns The same string.
 * @throws {RangeError} When `at` is not a valid date-time.
 */
function requireInstant(at: string): string {
  if (Number.isNaN(Date.parse(at))) {
    throw new RangeError('an assignment query requires a valid ISO 8601 instant');
  }
  return at;
}

/**
 * Finds the plan a revision belongs to in the tenant.
 *
 * @param world - Backing data.
 * @param tenantId - Tenant from the session.
 * @param planRevisionId - The revision.
 * @returns The plan, or undefined when the revision or plan isn't the tenant's.
 */
function planOf(world: CaseWorld, tenantId: string, planRevisionId: string) {
  const stored = (world.planRevisions ?? []).find(({ revision }) => revision.id === planRevisionId);
  return (world.plans ?? []).find(
    (plan) => plan.tenantId === tenantId && plan.id === stored?.revision.planId,
  );
}

/**
 * Decides whether a new case may be created, as the real repository does.
 *
 * @param world - Backing data.
 * @param tenantId - Tenant from the session.
 * @param newCase - The case to create.
 * @returns The refusal status, or null when the case may be created.
 */
function refusal(world: CaseWorld, tenantId: string, newCase: NewAdvisingCase) {
  const hasStudent = (world.students ?? []).some(
    (entry) => entry.tenantId === tenantId && entry.id === newCase.studentId,
  );
  if (!hasStudent) {
    return 'STUDENT_NOT_FOUND';
  }
  if (newCase.planRevisionId === null) {
    return null;
  }
  const plan = planOf(world, tenantId, newCase.planRevisionId);
  if (plan?.studentId !== newCase.studentId) {
    return 'PLAN_REVISION_NOT_FOUND';
  }
  const isTaken = (world.cases ?? []).some(
    (entry) =>
      entry.tenantId === tenantId &&
      isLive(entry.status) &&
      entry.planRevisionId !== null &&
      planOf(world, tenantId, entry.planRevisionId)?.id === plan.id,
  );
  return isTaken ? 'OPEN_CASE_EXISTS' : null;
}

/**
 * Stores a new case and its CREATE event.
 *
 * @param world - Backing data.
 * @param tenantId - Tenant from the session.
 * @param newCase - The case to create.
 * @returns The created result.
 */
function store(world: CaseWorld, tenantId: string, newCase: NewAdvisingCase): CreateCaseResult {
  const { actorUserId, createdAt, ...fields } = newCase;
  const created = createAdvisingCase({
    ...fields,
    id: syntheticId('advisingCase', (world.cases ?? []).length + 1),
    tenantId,
    createdAt,
    status: CaseStatus.Open,
    ownerUserId: null,
    lastSequence: 1,
  });
  const event = createCaseEvent({
    id: syntheticId('caseEvent', (world.caseEvents ?? []).length + 1),
    caseId: created.id,
    sequence: 1,
    action: CaseAction.Create,
    actorUserId,
    at: createdAt,
    fromStatus: null,
    toStatus: CaseStatus.Open,
    resolution: null,
    note: null,
  });
  world.cases = [...(world.cases ?? []), created];
  world.caseEvents = [...(world.caseEvents ?? []), event];
  return { status: 'CREATED', case: created, event };
}

/**
 * Appends an event to a case, deriving the owner from the new status.
 *
 * @param world - Backing data.
 * @param current - The case, already found in the tenant.
 * @param request - The sequence the caller saw and the event.
 * @returns The append result.
 */
function append(
  world: CaseWorld,
  current: AdvisingCase,
  request: AppendCaseEventRequest,
): AppendCaseEventResult {
  if (current.lastSequence !== request.expectedSequence) {
    return { status: 'SEQUENCE_CONFLICT' };
  }
  const { event: fields } = request;
  const hasOwner =
    fields.toStatus === CaseStatus.InReview || fields.toStatus === CaseStatus.Resolved;
  const updated = createAdvisingCase({
    ...current,
    status: fields.toStatus,
    ownerUserId: hasOwner ? fields.actorUserId : null,
    lastSequence: request.expectedSequence + 1,
  });
  const event = createCaseEvent({
    ...fields,
    id: syntheticId('caseEvent', (world.caseEvents ?? []).length + 1),
    caseId: current.id,
    sequence: request.expectedSequence + 1,
    fromStatus: current.status,
  });
  world.cases = (world.cases ?? []).map((entry) => (entry === current ? updated : entry));
  world.caseEvents = [...(world.caseEvents ?? []), event];
  return { status: 'APPENDED', case: updated, event };
}

/**
 * Orders cases oldest first, ties by ID.
 *
 * @param left - A case.
 * @param right - Another case.
 * @returns The comparison.
 */
function oldestFirst(left: AdvisingCase, right: AdvisingCase): number {
  return (
    Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id)
  );
}

/**
 * Tells whether the case's student has an assignment active at the instant.
 *
 * @param world - Backing data.
 * @param entry - The case.
 * @param query - The instant, and optionally only this advisor's assignments.
 * @returns True when one is active.
 */
function hasAssignment(
  world: CaseWorld,
  entry: AdvisingCase,
  query: { readonly at: string; readonly advisorUserId?: string | undefined },
): boolean {
  return (world.assignments ?? []).some(
    (assignment) =>
      assignment.tenantId === entry.tenantId &&
      assignment.studentId === entry.studentId &&
      (query.advisorUserId === undefined || assignment.advisorUserId === query.advisorUserId) &&
      isActiveAt(assignment, query.at),
  );
}

/**
 * Creates the advising case repository over the world.
 *
 * @param world - Backing data. Read and replaced on every call, so a case can inspect it.
 * @returns The case repositories.
 */
export function createCaseRepositories(world: CaseWorld): CaseRepositories {
  const inTenant = (tenantId: string): AdvisingCase[] =>
    (world.cases ?? []).filter((entry) => entry.tenantId === tenantId);
  const hasActive = (entry: AdvisingCase, at: string, advisorUserId?: string): boolean =>
    hasAssignment(world, entry, { at, advisorUserId });
  const cases: AdvisingCaseRepository = {
    create: (tenantId, newCase) => {
      const refused = refusal(world, tenantId, newCase);
      return Promise.resolve(
        refused === null ? store(world, tenantId, newCase) : { status: refused },
      );
    },
    appendEvent: (tenantId, caseId, request) => {
      const current = inTenant(tenantId).find((entry) => entry.id === caseId);
      return Promise.resolve(
        current === undefined ? { status: 'CASE_NOT_FOUND' } : append(world, current, request),
      );
    },
    findById: (tenantId, caseId) =>
      Promise.resolve(inTenant(tenantId).find((entry) => entry.id === caseId) ?? null),
    listEvents: (tenantId, caseId) =>
      Promise.resolve(
        inTenant(tenantId).some((entry) => entry.id === caseId)
          ? (world.caseEvents ?? [])
              .filter((event) => event.caseId === caseId)
              .toSorted((left, right) => left.sequence - right.sequence)
          : [],
      ),
    listForStudent: (tenantId, studentId) =>
      Promise.resolve(
        inTenant(tenantId)
          .filter((entry) => entry.studentId === studentId)
          .toSorted((left, right) => oldestFirst(right, left)),
      ),
    listQueue: (tenantId, advisorUserId, { at, status }) => {
      const instant = requireInstant(at);
      return Promise.resolve(
        inTenant(tenantId)
          .filter(
            (entry) =>
              hasActive(entry, instant, advisorUserId) &&
              (status === undefined || entry.status === status),
          )
          .toSorted(oldestFirst),
      );
    },
    listUnrouted: (tenantId, at) => {
      const instant = requireInstant(at);
      return Promise.resolve(
        inTenant(tenantId)
          .filter((entry) => entry.status === CaseStatus.Open && !hasActive(entry, instant))
          .toSorted(oldestFirst),
      );
    },
  };
  return { cases };
}
