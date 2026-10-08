/**
 * @file Applies a claim, release, resolve or withdraw to an advisor case. The case logic decides
 * every move; the action writes one event and changes nothing else (no plan, check, waiver or
 * source row), and nothing is sent or written to another system (FR-15).
 * @module @caa/api/modules/case-actions/case-actions.service
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-15
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { CaseEventRequest, CaseView } from '@caa/api-contract';
import type { AdvisingCaseRepository, StudentRepository } from '@caa/db';
import {
  type Actor,
  type AdvisingCase,
  CaseAction,
  type CaseId,
  type CaseStatus,
} from '@caa/domain';

import {
  InvalidRequestError,
  NotFoundError,
  RevisionConflictError,
} from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import type { CaseViewerService } from '../case-viewer/case-viewer.service';
import { caseActorOf, mayAttemptCaseAction, nextCaseStatus } from '../cases/cases.logic';

/** Dependencies of the case actions service. */
export interface CaseActionsServiceDependencies {
  readonly access: Pick<AccessService, 'canViewStudent'>;
  readonly cases: Pick<AdvisingCaseRepository, 'findById' | 'appendEvent' | 'listEvents'>;
  readonly students: Pick<StudentRepository, 'findById'>;
  readonly caseViewer: Pick<CaseViewerService, 'viewCase'>;
  /** Returns the current time; the only clock an event time comes from. */
  readonly now: () => Date;
}

/** What an action is for: the path case and the validated body. */
export interface AddCaseEventCommand {
  readonly caseId: CaseId;
  readonly body: CaseEventRequest;
}

/** Case actions. */
export interface CaseActionsService {
  /**
   * Claims, releases, resolves or withdraws a case: appends one event and moves the case. The
   * status each action leads to comes from `nextCaseStatus`.
   *
   * @param actor - Authenticated actor from the session.
   * @param command - The path case and the validated body.
   * @param context - Request-scoped values.
   * @returns The updated case as the actor sees it.
   * @throws {NotFoundError} When the case is missing, the actor may not see its student
   *   (including an assignment revoked since the claim), or the actor's relationship to the
   *   case never allows the action (a student claiming, a non-owner releasing or resolving, an
   *   advisor withdrawing, or a resolve of a case nobody claimed).
   * @throws {RevisionConflictError} When `expectedSequence` is stale, including a lost claim race.
   * @throws {InvalidRequestError} When the case's status doesn't allow the action, such as any
   *   action on a RESOLVED or WITHDRAWN case.
   * @throws {z.ZodError} When a stored case or event breaks a contract.
   */
  addCaseEvent(
    actor: Actor,
    command: AddCaseEventCommand,
    context: RequestContext,
  ): Promise<CaseView>;
}

/**
 * Logs one case action.
 *
 * @param actor - The user who acted.
 * @param done - The action taken and the status it moved the case between.
 * @param context - Request-scoped values.
 */
function logAction(
  actor: Actor,
  done: {
    readonly caseId: CaseId;
    readonly action: CaseAction;
    readonly fromStatus: CaseStatus;
    readonly toStatus: CaseStatus;
    readonly sequence: number;
  },
  context: RequestContext,
): void {
  // SECURITY: opaque IDs, the action and the statuses only (FR-14). Never a note.
  context.logger.info(
    { actorUserId: actor.userId, tenantId: actor.tenantId, ...done },
    'advisor case action',
  );
}

/**
 * Loads the case and decides whether and where the actor's action moves it.
 *
 * @param dependencies - Access rule and repositories.
 * @param call - The authenticated actor, the command, and the request-scoped values.
 * @returns The stored case and the status the action leads to.
 * @throws {NotFoundError} When the case is missing, not visible, or never open to this action
 *   for this actor.
 * @throws {RevisionConflictError} When `expectedSequence` is stale.
 * @throws {InvalidRequestError} When the status doesn't allow the action.
 */
async function decideMove(
  dependencies: CaseActionsServiceDependencies,
  call: {
    readonly actor: Actor;
    readonly command: AddCaseEventCommand;
    readonly context: RequestContext;
  },
): Promise<{ readonly advisingCase: AdvisingCase; readonly toStatus: CaseStatus }> {
  const { access, cases, students } = dependencies;
  const { actor, context } = call;
  const { caseId, body } = call.command;
  const advisingCase = await cases.findById(actor.tenantId, caseId);
  // SECURITY: access is rechecked on this call, so an assignment revoked since the claim is the
  // same NOT_FOUND as a missing case (AC15, AC36).
  if (
    advisingCase === null ||
    !(await access.canViewStudent(actor, advisingCase.studentId, context))
  ) {
    throw new NotFoundError();
  }
  const student = await students.findById(actor.tenantId, advisingCase.studentId);
  const kind = caseActorOf(
    { userId: actor.userId, studentUserId: student?.userId ?? null },
    advisingCase,
  );
  // SECURITY: an actor who could never take this action (a student claiming, a non-owner
  // releasing or resolving, an advisor withdrawing) can't learn the case exists.
  if (!mayAttemptCaseAction(body.action, kind)) {
    throw new NotFoundError();
  }
  if (body.expectedSequence !== advisingCase.lastSequence) {
    throw new RevisionConflictError();
  }
  // SECURITY: the case logic alone decides the move; the repository checks only the sequence.
  const toStatus = nextCaseStatus(advisingCase.status, body.action, kind);
  if (toStatus === null) {
    throw new InvalidRequestError();
  }
  return { advisingCase, toStatus };
}

/**
 * Creates the case actions service.
 *
 * @param dependencies - Access rule, repositories, viewer, and clock.
 * @returns A {@link CaseActionsService}.
 */
export function createCaseActionsService(
  dependencies: CaseActionsServiceDependencies,
): CaseActionsService {
  const { cases, caseViewer } = dependencies;
  return {
    async addCaseEvent(actor, command, context) {
      const { caseId, body } = command;
      const { advisingCase, toStatus } = await decideMove(dependencies, {
        actor,
        command,
        context,
      });
      const isResolve = body.action === CaseAction.Resolve;
      const result = await cases.appendEvent(actor.tenantId, caseId, {
        expectedSequence: body.expectedSequence,
        event: {
          action: body.action,
          actorUserId: actor.userId,
          at: dependencies.now().toISOString(),
          toStatus,
          resolution: isResolve ? (body.resolution ?? null) : null,
          note: isResolve ? (body.note ?? null) : null,
        },
      });
      if (result.status === 'SEQUENCE_CONFLICT') {
        throw new RevisionConflictError();
      }
      if (result.status !== 'APPENDED') {
        throw new NotFoundError();
      }
      const fromStatus = advisingCase.status;
      logAction(
        actor,
        { caseId, action: body.action, fromStatus, toStatus, sequence: result.event.sequence },
        context,
      );
      const events = await cases.listEvents(actor.tenantId, caseId);
      return caseViewer.viewCase(actor, { advisingCase: result.case, events }, context);
    },
  };
}
