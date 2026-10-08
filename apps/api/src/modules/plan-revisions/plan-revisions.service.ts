/**
 * @file Replays schedule options for a plan draft and writes the verified result as a plan
 * revision: the first revision of a term's plan, or the next one if the latest is still the one the
 * caller saw (ADR-0013 §1, §2, §4).
 * @module @caa/api/modules/plan-revisions/plan-revisions.service
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type {
  PlanView,
  ScheduleOptionsRequest,
  ScheduleOptionsResponse,
  SchedulePinnedInputs,
} from '@caa/api-contract';
import type { AuditSnapshotRepository, NewPlanRevision, PlanRepository } from '@caa/db';
import type {
  Actor,
  AuditSnapshotId,
  Plan,
  PlanRevisionCause,
  SectionId,
  StudentId,
} from '@caa/domain';

import {
  InvalidRequestError,
  NotFoundError,
  RevisionConflictError,
} from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import {
  auditMatchesPins,
  buildNewRevision,
  pinnedInputsMatch,
} from '../plan-drafts/plan-drafts.logic';
import type { PlanViewsService } from '../plan-views/plan-views.service';
import type { ScheduleOptionsService } from '../schedule-options/schedule-options.service';

/** Dependencies of the plan revisions service. */
export interface PlanRevisionsServiceDependencies {
  /** The existing schedule options service, freshness gate included. */
  readonly scheduleOptions: Pick<ScheduleOptionsService, 'findOptions'>;
  readonly auditSnapshots: Pick<AuditSnapshotRepository, 'findLatest'>;
  readonly plans: PlanRepository;
  readonly views: PlanViewsService;
  /** The injected clock. */
  readonly now: () => Date;
}

/** What a verified replay yields: the result to store, the chosen sections, and the audit ID. */
export interface VerifiedReplay {
  readonly result: ScheduleOptionsResponse;
  readonly selectedSectionIds: readonly SectionId[] | null;
  readonly auditSnapshotId: AuditSnapshotId;
}

/** What a replay is run for. */
export interface ReplayCall {
  readonly actor: Actor;
  readonly studentId: StudentId;
  readonly request: ScheduleOptionsRequest;
  /** What the client was shown, or null when the inputs come from a stored revision. */
  readonly expectedPins: SchedulePinnedInputs | null;
  /** Picks the stored selection from the replay; `INVALID` is refused. */
  readonly choose: (result: ScheduleOptionsResponse) => readonly SectionId[] | null | 'INVALID';
}

/**
 * Replays schedule options and checks the replay against what the client was shown.
 *
 * @param dependencies - Schedule options and the audit repository.
 * @param call - The actor, student, request, expected pins, and selection rule.
 * @param context - Request-scoped values.
 * @returns The verified replay.
 * @throws {RevisionConflictError} When the pinned inputs or the audit differ from the client's.
 * @throws {InvalidRequestError} When the chosen sections aren't one of the replayed options.
 */
async function replayAndVerify(
  dependencies: PlanRevisionsServiceDependencies,
  call: ReplayCall,
  context: RequestContext,
): Promise<VerifiedReplay> {
  const { actor, studentId, request, expectedPins, choose } = call;
  // SECURITY: the replay applies the access rule, the freshness gate, and the tenant filter
  // again, and nothing the client sent as a result is read.
  const result = await dependencies.scheduleOptions.findOptions(
    actor,
    { studentId, ...request },
    context,
  );
  // SAFETY: a replay on other inputs than the client saw is a conflict, so the student never
  // saves a plan from options they were not shown.
  if (expectedPins !== null && !pinnedInputsMatch(result.pinnedInputs, expectedPins)) {
    throw new RevisionConflictError();
  }
  const selectedSectionIds = choose(result);
  if (selectedSectionIds === 'INVALID') {
    throw new InvalidRequestError();
  }
  const latestAudit = await dependencies.auditSnapshots.findLatest(actor.tenantId, studentId);
  // SAFETY: the stored audit ID must be the audit the replay pinned; if it moved in between,
  // nothing is written (ADR-0013 §2).
  if (
    latestAudit?.status !== 'FOUND' ||
    !auditMatchesPins(latestAudit.audit, result.pinnedInputs)
  ) {
    throw new RevisionConflictError();
  }
  return { result, selectedSectionIds, auditSnapshotId: latestAudit.audit.id };
}

/** What an append states. */
export interface AppendCall {
  readonly tenantId: Actor['tenantId'];
  readonly plan: Plan;
  /** The latest revision the caller saw. */
  readonly expectedRevision: number;
  readonly revision: NewPlanRevision;
}

/** What a create-or-append for a term states. */
export interface CreateCall {
  readonly tenantId: Actor['tenantId'];
  readonly studentId: StudentId;
  readonly revision: NewPlanRevision;
}

/** A revision written to a plan. */
export interface WrittenRevision {
  readonly plan: Plan;
  readonly revision: number;
}

/**
 * Appends the next revision to a plan, only if the latest is still the one the caller saw.
 *
 * @param plans - The plan repository.
 * @param call - The tenant, the plan, the latest revision seen, and the revision to write.
 * @returns The plan and the number written.
 * @throws {RevisionConflictError} When another write won the race.
 * @throws {NotFoundError} When the plan vanished.
 */
async function appendTo(plans: PlanRepository, call: AppendCall): Promise<WrittenRevision> {
  const { tenantId, plan, expectedRevision, revision } = call;
  const appended = await plans.appendRevision(tenantId, plan.id, { expectedRevision, revision });
  if (appended.status === 'PLAN_NOT_FOUND') {
    throw new NotFoundError();
  }
  if (appended.status !== 'APPENDED') {
    throw new RevisionConflictError();
  }
  return { plan, revision: appended.revision.revision.revision };
}

/**
 * Creates the term's plan with revision 1, or appends the next revision to the existing plan.
 *
 * @param plans - The plan repository.
 * @param call - The tenant, student, and term, and the revision to write.
 * @returns The plan and the number written.
 * @throws {RevisionConflictError} When another save won the race.
 * @throws {NotFoundError} When the plan vanished.
 */
async function writeRevision(plans: PlanRepository, call: CreateCall): Promise<WrittenRevision> {
  const { tenantId, studentId, revision } = call;
  const existing = (await plans.listForStudent(tenantId, studentId)).find(
    ({ plan }) => plan.termId === revision.termId,
  );
  if (existing === undefined) {
    const created = await plans.createWithFirstRevision(
      tenantId,
      { studentId, termId: revision.termId, createdAt: revision.createdAt },
      revision,
    );
    // SAFETY: a plan created by a racing save is a conflict, never a second plan for the term.
    if (created.status !== 'CREATED') {
      throw new RevisionConflictError();
    }
    return { plan: created.plan, revision: created.revision.revision.revision };
  }
  return appendTo(plans, {
    tenantId,
    plan: existing.plan,
    expectedRevision: existing.latest.revision.revision,
    revision,
  });
}

/** Where a recorded revision goes: the term's plan (created if none), or a given plan's next number. */
export type RecordTarget =
  | { readonly kind: 'TERM_PLAN'; readonly studentId: StudentId }
  | { readonly kind: 'NEXT_REVISION'; readonly plan: Plan; readonly expectedRevision: number };

/** What a recorded revision is made from. */
export interface RecordCall {
  readonly actor: Actor;
  readonly request: ScheduleOptionsRequest;
  readonly replay: VerifiedReplay;
  readonly cause: PlanRevisionCause;
  /** The log message: what happened, with no identifying content. */
  readonly message: string;
  readonly target: RecordTarget;
}

/** Replays plan inputs and records the verified result as a revision. */
export interface PlanRevisionsService {
  /**
   * Replays schedule options and checks the replay against what the client was shown.
   *
   * @param call - The actor, student, request, expected pins, and selection rule.
   * @param context - Request-scoped values.
   * @returns The verified replay.
   * @throws {RevisionConflictError} When the pinned inputs or the audit differ from the client's.
   * @throws {InvalidRequestError} When the chosen sections aren't one of the replayed options.
   * @throws {StaleSourceError} When the replay's sources are stale or tied.
   * @throws {SourceUnavailableError} When a source is missing.
   */
  replay(call: ReplayCall, context: RequestContext): Promise<VerifiedReplay>;

  /**
   * Builds the revision from the verified replay, writes it, logs it, and returns the plan view.
   *
   * @param call - The actor, request, replay, cause, log message, and where to write.
   * @param context - Request-scoped values; the log line carries opaque IDs only.
   * @returns The plan with its new latest revision.
   * @throws {RevisionConflictError} When another write won the race.
   * @throws {NotFoundError} When the plan vanished.
   * @throws {Error} When the revision history has a gap, or a stored revision breaks its contract.
   */
  record(call: RecordCall, context: RequestContext): Promise<PlanView>;
}

/**
 * Creates the plan revisions service.
 *
 * @param dependencies - Schedule options, the audit and plan repositories, plan views, and the clock.
 * @returns A {@link PlanRevisionsService}.
 */
export function createPlanRevisionsService(
  dependencies: PlanRevisionsServiceDependencies,
): PlanRevisionsService {
  return {
    replay: (call, context) => replayAndVerify(dependencies, call, context),
    async record(call, context) {
      const { actor, request, replay, cause, target } = call;
      const revision = buildNewRevision({
        request,
        ...replay,
        cause,
        createdBy: actor.userId,
        createdAt: dependencies.now().toISOString(),
      });
      const written =
        target.kind === 'TERM_PLAN'
          ? await writeRevision(dependencies.plans, {
              tenantId: actor.tenantId,
              studentId: target.studentId,
              revision,
            })
          : await appendTo(dependencies.plans, {
              tenantId: actor.tenantId,
              plan: target.plan,
              expectedRevision: target.expectedRevision,
              revision,
            });
      context.logger.info(
        {
          actorUserId: actor.userId,
          tenantId: actor.tenantId,
          studentId: written.plan.studentId,
          planId: written.plan.id,
          revision: written.revision,
          outcome: replay.result.outcome,
        },
        call.message,
      );
      return dependencies.views.viewOf(actor, written.plan, context);
    },
  };
}
