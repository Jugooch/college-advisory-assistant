/**
 * @file Saves a plan draft by replaying schedule options on the server.
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
import type { PlanView, SavePlanRequest } from '@caa/api-contract';
import { type Actor, PlanRevisionCause, type StudentId } from '@caa/domain';

import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import type { PlanRevisionsService } from '../plan-revisions/plan-revisions.service';
import { resolveSelection } from './plan-drafts.logic';

/** Dependencies of the plan drafts service. */
export interface PlanDraftsServiceDependencies {
  readonly access: Pick<AccessService, 'canSavePlan'>;
  /** Replays schedule options and records the verified revision. */
  readonly revisions: PlanRevisionsService;
}

/** What a save is for: the path student and the validated body. Identity is never part of it. */
export interface SavePlanQuery {
  readonly studentId: StudentId;
  readonly body: SavePlanRequest;
}

/** Saves plan drafts. Reads are in the plan views service; revalidation in its own service. */
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

/**
 * Creates the plan drafts service.
 *
 * @param dependencies - The access rule and the plan revisions service.
 * @returns A {@link PlanDraftsService}.
 */
export function createPlanDraftsService(
  dependencies: PlanDraftsServiceDependencies,
): PlanDraftsService {
  const { access, revisions } = dependencies;
  return {
    async savePlan(actor, query, context) {
      const { studentId, body } = query;
      // SECURITY: only the student's own record may be saved to; an assigned advisor, an admin,
      // another student, and another tenant all get the same NOT_FOUND (ADR-0013 §5).
      if (!(await access.canSavePlan(actor, studentId, context))) {
        throw new NotFoundError();
      }
      const replay = await revisions.replay(
        {
          actor,
          studentId,
          request: body.request,
          expectedPins: body.expectedPinnedInputs,
          choose: (result) => resolveSelection(result, body.selectedSectionIds),
        },
        context,
      );
      return revisions.record(
        {
          actor,
          request: body.request,
          replay,
          cause: PlanRevisionCause.Saved,
          message: 'plan draft saved',
          target: { kind: 'TERM_PLAN', studentId },
        },
        context,
      );
    },
  };
}
