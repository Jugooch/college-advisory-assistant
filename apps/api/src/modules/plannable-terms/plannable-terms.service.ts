/**
 * @file Lists the terms a student can plan for: those whose latest published section snapshot
 * is unique and fresh. Read-only; loads no student record and runs no engine.
 * @module @caa/api/modules/plannable-terms/plannable-terms.service
 * @requirement FR-08
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type { PlannableTermsResponse } from '@caa/api-contract';
import type { TermSectionSnapshotRepository } from '@caa/db';
import type { Actor, StudentId } from '@caa/domain';

import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import { selectPlannableTerms } from './plannable-terms.logic';

/** Dependencies of the plannable terms service. */
export interface PlannableTermsServiceDependencies {
  readonly access: AccessService;
  readonly sectionSnapshots: TermSectionSnapshotRepository;
  /** Returns the current time. */
  readonly now: () => Date;
  /** Validated `ACADEMIC_SOURCE_MAX_AGE_MS`. */
  readonly maxSourceAgeMs: number;
}

/** Plannable term reads, gated by the access service. */
export interface PlannableTermsService {
  /**
   * Lists the tenant's terms the student could plan for now.
   *
   * @param actor - Authenticated actor from the session.
   * @param studentId - Internal student ID from the path.
   * @param context - Request-scoped values; the logger records counts and excluded term IDs.
   * @returns The plannable terms in term sequence order; empty when none qualifies.
   * @throws {NotFoundError} When the student doesn't exist or the actor may not see them.
   */
  listPlannableTerms(
    actor: Actor,
    studentId: StudentId,
    context: RequestContext,
  ): Promise<PlannableTermsResponse>;
}

/**
 * Creates the plannable terms service.
 *
 * @param dependencies - Access service, section snapshot repository, clock, and maximum age.
 * @returns A {@link PlannableTermsService}.
 */
export function createPlannableTermsService(
  dependencies: PlannableTermsServiceDependencies,
): PlannableTermsService {
  return {
    async listPlannableTerms(actor, studentId, context) {
      // SECURITY: denied and missing are the same NOT_FOUND, so existence isn't revealed.
      if (!(await dependencies.access.canViewStudent(actor, studentId, context))) {
        throw new NotFoundError();
      }
      // SECURITY: the tenant is the session's; nothing in the request names one.
      const entries = await dependencies.sectionSnapshots.listLatestPublishedByTerm(actor.tenantId);
      const { terms, excluded } = selectPlannableTerms(entries, {
        now: dependencies.now(),
        maxAgeMs: dependencies.maxSourceAgeMs,
      });
      context.logger.info(
        { tenantId: actor.tenantId, listedCount: terms.length, excluded },
        'plannable terms listed',
      );
      return { terms };
    },
  };
}
