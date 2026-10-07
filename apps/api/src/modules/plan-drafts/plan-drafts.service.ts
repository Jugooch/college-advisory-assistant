/**
 * @file Saves a plan draft by replaying schedule options on the server, and reads saved plans.
 * The client's evidence is never stored: the stored result is the server's own replay (ADR-0013 §2).
 * @module @caa/api/modules/plan-drafts/plan-drafts.service
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-11
 * @requirement FR-14
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { PlanView, SavePlanRequest, ScheduleOptionsResponse } from '@caa/api-contract';
import type { AuditSnapshotRepository, NewPlanRevision, PlanRepository } from '@caa/db';
import {
  type Actor,
  type AuditSnapshotId,
  type Plan,
  PlanRevisionCause,
  type SectionId,
  type StudentId,
} from '@caa/domain';

import {
  InvalidRequestError,
  NotFoundError,
  RevisionConflictError,
} from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import type { PlanViewsService } from '../plan-views/plan-views.service';
import type { ScheduleOptionsService } from '../schedule-options/schedule-options.service';
import {
  auditMatchesPins,
  buildNewRevision,
  pinnedInputsMatch,
  resolveSelection,
} from './plan-drafts.logic';

/** Dependencies of the plan drafts service. */
export interface PlanDraftsServiceDependencies {
  readonly access: Pick<AccessService, 'canSavePlan'>;
  /** The existing schedule options service, freshness gate included. */
  readonly scheduleOptions: Pick<ScheduleOptionsService, 'findOptions'>;
  readonly auditSnapshots: Pick<AuditSnapshotRepository, 'findLatest'>;
  readonly plans: PlanRepository;
  readonly views: PlanViewsService;
  /** The injected clock. */
  readonly now: () => Date;
}

/** What a save is for: the path student and the validated body. Identity is never part of it. */
export interface SavePlanQuery {
  readonly studentId: StudentId;
  readonly body: SavePlanRequest;
}

/** Saves plan drafts. Reads are in {@link PlanViewsService}. */
export interface PlanDraftsService {
  /**
   * Replays schedule options for the student's own record and stores the result as the term's
   * next revision.
   *
   * @param actor - Authenticated actor from the session; must be the student themself.
   * @param query - The path student and the validated body.
   * @param context - Request-scoped values; log lines carry opaque IDs only.
   * @returns The plan with its new latest revision.
   * @throws {NotFoundError} When the actor isn't the student, or the student is missing.
   * @throws {RevisionConflictError} When the replay's pinned inputs differ from the client's, or
   *   another save raced this one, or the replay's audit check conflicts. Nothing is written.
   * @throws {InvalidRequestError} When the chosen sections aren't one of the replayed options.
   * @throws {StaleSourceError} When the replay's sources are stale or tied. Nothing is written.
   * @throws {SourceUnavailableError} When a source is missing. Nothing is written.
   * @throws {Error} When the saved plan's revision history has a gap, or a stored revision
   *   breaks the revision view contract.
   */
  savePlan(actor: Actor, query: SavePlanQuery, context: RequestContext): Promise<PlanView>;
}

/** What a verified replay yields: the result to store, the chosen sections, and the audit ID. */
interface VerifiedReplay {
  readonly result: ScheduleOptionsResponse;
  readonly selectedSectionIds: readonly SectionId[] | null;
  readonly auditSnapshotId: AuditSnapshotId;
}

/**
 * Replays schedule options and checks the replay against what the client was shown.
 *
 * @param dependencies - Schedule options and the audit repository.
 * @param call - The actor and the path student with the body.
 * @param context - Request-scoped values.
 * @returns The verified replay.
 * @throws {RevisionConflictError} When the pinned inputs or the audit differ from the client's.
 * @throws {InvalidRequestError} When the chosen sections aren't one of the replayed options.
 */
async function replayAndVerify(
  dependencies: PlanDraftsServiceDependencies,
  call: { readonly actor: Actor; readonly query: SavePlanQuery },
  context: RequestContext,
): Promise<VerifiedReplay> {
  const { actor, query } = call;
  const { studentId, body } = query;
  // SECURITY: the replay applies the access rule, the freshness gate, and the tenant filter
  // again, and nothing the client sent as a result is read.
  const result = await dependencies.scheduleOptions.findOptions(
    actor,
    { studentId, ...body.request },
    context,
  );
  // SAFETY: a replay on other inputs than the client saw is a conflict, so the student never
  // saves a plan from options they were not shown.
  if (!pinnedInputsMatch(result.pinnedInputs, body.expectedPinnedInputs)) {
    throw new RevisionConflictError();
  }
  const selectedSectionIds = resolveSelection(result, body.selectedSectionIds);
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

/** A revision written to a plan. */
interface WrittenRevision {
  readonly plan: Plan;
  readonly revision: number;
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
async function writeRevision(
  plans: PlanRepository,
  call: {
    readonly tenantId: Actor['tenantId'];
    readonly studentId: StudentId;
    readonly revision: NewPlanRevision;
  },
): Promise<WrittenRevision> {
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
  const appended = await plans.appendRevision(tenantId, existing.plan.id, {
    expectedRevision: existing.latest.revision.revision,
    revision,
  });
  if (appended.status === 'PLAN_NOT_FOUND') {
    throw new NotFoundError();
  }
  if (appended.status !== 'APPENDED') {
    throw new RevisionConflictError();
  }
  return { plan: existing.plan, revision: appended.revision.revision.revision };
}

/**
 * Creates the plan drafts service.
 *
 * @param dependencies - Access rule, schedule options, audit and plan repositories, and the clock.
 * @returns A {@link PlanDraftsService}.
 */
export function createPlanDraftsService(
  dependencies: PlanDraftsServiceDependencies,
): PlanDraftsService {
  return {
    async savePlan(actor, query, context) {
      const { studentId, body } = query;
      // SECURITY: only the student's own record may be saved to; an assigned advisor, an admin,
      // another student, and another tenant all get the same NOT_FOUND (ADR-0013 §5).
      if (!(await dependencies.access.canSavePlan(actor, studentId, context))) {
        throw new NotFoundError();
      }
      const replay = await replayAndVerify(dependencies, { actor, query }, context);
      const revision = buildNewRevision({
        request: body.request,
        ...replay,
        cause: PlanRevisionCause.Saved,
        createdBy: actor.userId,
        createdAt: dependencies.now().toISOString(),
      });
      const written = await writeRevision(dependencies.plans, {
        tenantId: actor.tenantId,
        studentId,
        revision,
      });
      context.logger.info(
        {
          actorUserId: actor.userId,
          tenantId: actor.tenantId,
          studentId,
          planId: written.plan.id,
          revision: written.revision,
          outcome: replay.result.outcome,
        },
        'plan draft saved',
      );
      return dependencies.views.viewOf(actor, written.plan, context);
    },
  };
}
