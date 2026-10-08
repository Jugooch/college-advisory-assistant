/**
 * @file Shows a stored case to the signed-in actor: the actor's relationship to the case, the
 * frozen plan revision, and the actions allowed now. Shared by the cases and case-actions
 * services. No user ID leaves it.
 * @module @caa/api/modules/case-viewer/case-viewer.service
 * @requirement FR-12
 * @requirement FR-14
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { CaseView } from '@caa/api-contract';
import type { StudentRepository } from '@caa/db';
import type { Actor, AdvisingCase, CaseEvent } from '@caa/domain';

import type { RequestContext } from '../../shared/request-context';
import type { CaseContextService } from '../case-context/case-context.service';
import { allowedCaseActions, caseActorOf } from '../cases/cases.logic';
import { toCaseView } from '../cases/cases.mapper';

/** A case with its events, as read from the repository. */
export interface StoredCase {
  readonly advisingCase: AdvisingCase;
  readonly events: readonly CaseEvent[];
}

/** Shows a stored case to an actor. */
export interface CaseViewerService {
  /**
   * Shows a stored case to the signed-in actor: their relationship to it, the frozen plan
   * revision, and the actions allowed now.
   *
   * @param actor - Authenticated actor from the session.
   * @param stored - The case and its events.
   * @param context - Request-scoped values.
   * @returns The case view, with no user ID.
   * @throws {NotFoundError} When the frozen revision is missing.
   * @throws {z.ZodError} When a stored row breaks a contract.
   */
  viewCase(actor: Actor, stored: StoredCase, context: RequestContext): Promise<CaseView>;
}

/** Dependencies of the case viewer. */
export interface CaseViewerDependencies {
  readonly students: Pick<StudentRepository, 'findById'>;
  readonly caseContext: CaseContextService;
}

/**
 * Creates the case viewer service.
 *
 * @param dependencies - Student repository and context reader.
 * @returns A {@link CaseViewerService}.
 */
export function createCaseViewerService(dependencies: CaseViewerDependencies): CaseViewerService {
  const { students, caseContext } = dependencies;
  const viewCase: CaseViewerService['viewCase'] = async (actor, stored, context) => {
    const { advisingCase } = stored;
    const student = await students.findById(actor.tenantId, advisingCase.studentId);
    const studentUserId = student?.userId ?? null;
    const kind = caseActorOf({ userId: actor.userId, studentUserId }, advisingCase);
    return toCaseView({
      advisingCase,
      events: stored.events,
      studentUserId,
      viewer: actor,
      context:
        advisingCase.planRevisionId === null
          ? null
          : await caseContext.contextOf(
              actor,
              { studentId: advisingCase.studentId, planRevisionId: advisingCase.planRevisionId },
              context,
            ),
      allowedActions: allowedCaseActions(advisingCase.status, kind),
    });
  };
  return { viewCase };
}
