/**
 * @file In-memory fake of the advising case repository for API tests, with the same tenant
 * filter, one-open-case-per-plan rule, and sequence guard as PostgreSQL. Test code only; never
 * wired by the container.
 * @module @caa/api/testing/in-memory-case-repositories
 * @see docs/standards/07-testing.md
 */
import type {
  AdvisingCaseRepository,
  AppendCaseEventRequest,
  AppendCaseEventResult,
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
  type PlanId,
  type Student,
} from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import type { InMemoryPlanStore } from './in-memory-plan-repositories';

/** Case backing data. Every field omitted means none stored. */
export interface InMemoryCaseStore extends InMemoryPlanStore {
  students?: readonly Student[];
  assignments?: readonly AdvisorAssignment[];
  cases?: readonly AdvisingCase[];
  /** Every event of every case, oldest first. */
  caseEvents?: readonly CaseEvent[];
}

/**
 * Tells whether a case still holds its plan's single open slot.
 *
 * @param status - The case's status.
 * @returns True for OPEN and IN_REVIEW.
 */
function isLive(status: CaseStatus): boolean {
  return status === CaseStatus.Open || status === CaseStatus.InReview;
}

/**
 * Tells whether the assignment is active at the instant. Start is inclusive, end exclusive.
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
 * Decides whether a case may be created, as the real repository does.
 *
 * @param store - Backing data.
 * @param tenantId - Tenant from the session.
 * @param newCase - The case to create.
 * @returns The refusal status, or null when the case may be created.
 */
function refusalFor(store: InMemoryCaseStore, tenantId: string, newCase: NewAdvisingCase) {
  const hasStudent = (store.students ?? []).some(
    (entry) => entry.tenantId === tenantId && entry.id === newCase.studentId,
  );
  if (!hasStudent) {
    return 'STUDENT_NOT_FOUND';
  }
  if (newCase.planRevisionId === null) {
    return null;
  }
  const planOf = (revisionId: string | null) => {
    const stored = (store.planRevisions ?? []).find(({ revision }) => revision.id === revisionId);
    return (store.plans ?? []).find((plan) => plan.id === stored?.revision.planId);
  };
  const plan = planOf(newCase.planRevisionId);
  if (plan?.tenantId !== tenantId || plan.studentId !== newCase.studentId) {
    return 'PLAN_REVISION_NOT_FOUND';
  }
  const hasLive = (store.cases ?? []).some(
    (entry) =>
      entry.tenantId === tenantId &&
      entry.tenantId === tenantId &&
      isLive(entry.status) &&
      planOf(entry.planRevisionId)?.id === plan.id,
  );
  return hasLive ? 'OPEN_CASE_EXISTS' : null;
}

/**
 * Stores a new case and its CREATE event.
 *
 * @param store - Backing data.
 * @param tenantId - Tenant from the session.
 * @param newCase - The case to create.
 * @returns The stored case and event.
 */
function storeNewCase(store: InMemoryCaseStore, tenantId: string, newCase: NewAdvisingCase) {
  const { actorUserId, ...fields } = newCase;
  const created = createAdvisingCase({
    ...fields,
    id: syntheticId('advisingCase', (store.cases ?? []).length + 1),
    tenantId,
    status: CaseStatus.Open,
    ownerUserId: null,
    lastSequence: 1,
  });
  const event = createCaseEvent({
    id: syntheticId('caseEvent', (store.caseEvents ?? []).length + 1),
    caseId: created.id,
    sequence: 1,
    action: CaseAction.Create,
    actorUserId,
    at: newCase.createdAt,
    fromStatus: null,
    toStatus: CaseStatus.Open,
    resolution: null,
    note: null,
  });
  store.cases = [...(store.cases ?? []), created];
  store.caseEvents = [...(store.caseEvents ?? []), event];
  return { case: created, event };
}

/**
 * Appends an event, guarded by the caller's expected sequence, like the real repository. The
 * transition itself is not checked; that is the api's rule.
 *
 * @param store - Backing data.
 * @param tenantId - Tenant from the session.
 * @param target - The case and what the caller states and does.
 * @returns The result of the append.
 */
function appendTo(
  store: InMemoryCaseStore,
  tenantId: string,
  target: { readonly caseId: string; readonly request: AppendCaseEventRequest },
): AppendCaseEventResult {
  const { caseId, request } = target;
  const found = (store.cases ?? []).find(
    (entry) => entry.tenantId === tenantId && entry.id === caseId,
  );
  if (found === undefined) {
    return { status: 'CASE_NOT_FOUND' };
  }
  if (found.lastSequence !== request.expectedSequence) {
    return { status: 'SEQUENCE_CONFLICT' };
  }
  const event = createCaseEvent({
    ...request.event,
    id: syntheticId('caseEvent', (store.caseEvents ?? []).length + 1),
    caseId: found.id,
    sequence: found.lastSequence + 1,
    fromStatus: found.status,
  });
  const hasOwner = event.toStatus === CaseStatus.InReview || event.toStatus === CaseStatus.Resolved;
  const updated = createAdvisingCase({
    ...found,
    status: event.toStatus,
    ownerUserId: hasOwner ? event.actorUserId : null,
    lastSequence: event.sequence,
  });
  store.cases = (store.cases ?? []).map((entry) => (entry.id === found.id ? updated : entry));
  store.caseEvents = [...(store.caseEvents ?? []), event];
  return { status: 'APPENDED', case: updated, event };
}

/**
 * Finds the live case of each given plan, reaching the plan through the revision the case froze.
 *
 * @param store - Backing data.
 * @param tenantId - Tenant from the session.
 * @param planIds - The plans wanted.
 * @returns A map from plan ID to its live case.
 */
function liveByPlan(
  store: InMemoryCaseStore,
  tenantId: string,
  planIds: readonly PlanId[],
): ReadonlyMap<PlanId, AdvisingCase> {
  const planOf = new Map(
    (store.planRevisions ?? []).map(({ revision }) => [revision.id, revision.planId]),
  );
  return new Map(
    (store.cases ?? []).flatMap((entry) => {
      const planId = entry.planRevisionId === null ? undefined : planOf.get(entry.planRevisionId);
      return entry.tenantId === tenantId &&
        isLive(entry.status) &&
        planId !== undefined &&
        planIds.includes(planId)
        ? [[planId, entry] as const]
        : [];
    }),
  );
}

/**
 * Creates the case repository over the store, filtered by tenant like PostgreSQL.
 *
 * @param store - Backing data. Read and replaced on every call.
 * @returns An {@link AdvisingCaseRepository}.
 */
export function createInMemoryCaseRepository(store: InMemoryCaseStore): AdvisingCaseRepository {
  const inTenant = (tenantId: string) =>
    (store.cases ?? []).filter((entry) => entry.tenantId === tenantId);
  const isAssigned = (entry: AdvisingCase, at: string, advisor?: string) =>
    (store.assignments ?? []).some(
      (assignment) =>
        assignment.tenantId === entry.tenantId &&
        assignment.studentId === entry.studentId &&
        (advisor === undefined || assignment.advisorUserId === advisor) &&
        isActiveAt(assignment, at),
    );
  return {
    create: (tenantId, newCase) => {
      const refusal = refusalFor(store, tenantId, newCase);
      return Promise.resolve(
        refusal === null
          ? { status: 'CREATED', ...storeNewCase(store, tenantId, newCase) }
          : { status: refusal },
      );
    },
    appendEvent: (tenantId, caseId, request) =>
      Promise.resolve(appendTo(store, tenantId, { caseId, request })),
    findById: (tenantId, caseId) =>
      Promise.resolve(inTenant(tenantId).find((entry) => entry.id === caseId) ?? null),
    listEvents: (tenantId, caseId) =>
      Promise.resolve(
        inTenant(tenantId).some((entry) => entry.id === caseId)
          ? (store.caseEvents ?? []).filter((event) => event.caseId === caseId)
          : [],
      ),
    listForStudent: (tenantId, studentId) =>
      Promise.resolve(
        inTenant(tenantId)
          .filter((entry) => entry.studentId === studentId)
          .toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
      ),
    findLiveByPlanIds: (tenantId, planIds) => Promise.resolve(liveByPlan(store, tenantId, planIds)),
    listQueue: (tenantId, advisorUserId, { at, status }) =>
      Promise.resolve(
        inTenant(tenantId).filter(
          (entry) =>
            (status === undefined || entry.status === status) &&
            isAssigned(entry, at, advisorUserId),
        ),
      ),
    listTenantQueue: (tenantId, { at, status }) =>
      Promise.resolve(
        inTenant(tenantId)
          .filter((entry) => status === undefined || entry.status === status)
          .map((entry) => ({ ...entry, routed: isAssigned(entry, at) }))
          .toSorted((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
      ),
    listUnrouted: (tenantId, at) =>
      Promise.resolve(
        inTenant(tenantId).filter(
          (entry) => entry.status === CaseStatus.Open && !isAssigned(entry, at),
        ),
      ),
  };
}
