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
export type CaseViewer = (
  actor: Actor,
  stored: StoredCase,
  context: RequestContext,
) => Promise<CaseView>;

/** Dependencies of the case viewer. */
export interface CaseViewerDependencies {
  readonly students: Pick<StudentRepository, 'findById'>;
  readonly caseContext: CaseContextService;
}

/**
 * Creates the function that shows a stored case to the signed-in actor.
 *
 * @param dependencies - Student repository and context reader.
 * @returns A function from the actor and a stored case to the case view. It throws
 *   `NotFoundError` when the frozen revision is missing, and `Error` when a stored row breaks a
 *   contract.
 */
export function createCaseViewer(dependencies: CaseViewerDependencies): CaseViewer {
  const { students, caseContext } = dependencies;
  return async (actor, stored, context) => {
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
}
