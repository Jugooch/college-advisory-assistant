/**
 * @file Pure rules for who may take which action on an advising case, and the status each
 * allowed action leads to. The cases service calls this; no I/O, clock, or logging happens here.
 * @module @caa/api/modules/cases/cases.logic
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 * @see docs/adr/0008-pure-logic-files.md
 */
import { type AdvisingCase, CaseAction, CaseStatus, type UserId } from '@caa/domain';

/**
 * What the session's user is to one case. The service derives it from the session and the case;
 * it is never read from a request.
 */
export const CaseActor = {
  /** The student the case is about. */
  Student: 'STUDENT',
  /** The advisor or admin who currently owns the case (claimed it, or resolved it). */
  Owner: 'OWNER',
  /** An assigned advisor or admin who is not the owner. */
  Reviewer: 'REVIEWER',
} as const;

/** What the session's user is to one case. */
export type CaseActor = (typeof CaseActor)[keyof typeof CaseActor];

/** One allowed move: who may take the action from the status, and where it leads. */
interface Transition {
  readonly from: CaseStatus;
  readonly action: CaseAction;
  readonly actor: CaseActor;
  readonly to: CaseStatus;
}

// SECURITY: the whole transition table (ADR-0013 §6). Anything not listed is refused, so a new
// status, action, or actor is denied until someone adds a row. CREATE is never listed: it only
// happens through the create endpoint. RESOLVED and WITHDRAWN have no rows, so they are final.
const TRANSITIONS: readonly Transition[] = [
  {
    from: CaseStatus.Open,
    action: CaseAction.Withdraw,
    actor: CaseActor.Student,
    to: CaseStatus.Withdrawn,
  },
  {
    from: CaseStatus.Open,
    action: CaseAction.Claim,
    actor: CaseActor.Reviewer,
    to: CaseStatus.InReview,
  },
  {
    from: CaseStatus.InReview,
    action: CaseAction.Withdraw,
    actor: CaseActor.Student,
    to: CaseStatus.Withdrawn,
  },
  {
    from: CaseStatus.InReview,
    action: CaseAction.Release,
    actor: CaseActor.Owner,
    to: CaseStatus.Open,
  },
  {
    from: CaseStatus.InReview,
    action: CaseAction.Resolve,
    actor: CaseActor.Owner,
    to: CaseStatus.Resolved,
  },
];

/**
 * Decides the status an action leads to.
 *
 * @param status - The case's current status.
 * @param action - What the actor wants to do.
 * @param actor - What the session's user is to the case.
 * @returns The next status, or null when the actor may not take the action from this status.
 */
export function nextCaseStatus(
  status: CaseStatus,
  action: CaseAction,
  actor: CaseActor,
): CaseStatus | null {
  // SECURITY: deny by default; only a listed row allows a move.
  const match = TRANSITIONS.find(
    (row) => row.from === status && row.action === action && row.actor === actor,
  );
  return match?.to ?? null;
}

/**
 * Lists the actions the actor may take now, for the case view's `allowedActions`. It agrees with
 * {@link nextCaseStatus} by construction.
 *
 * @param status - The case's current status.
 * @param actor - What the session's user is to the case.
 * @returns The allowed actions, each once, in table order.
 */
export function allowedCaseActions(status: CaseStatus, actor: CaseActor): readonly CaseAction[] {
  return TRANSITIONS.filter((row) => row.from === status && row.actor === actor).map(
    (row) => row.action,
  );
}

/**
 * Derives what the session's user is to a case, from the session and the stored case only.
 *
 * @param actor - The session's user ID and the user linked to the case's student.
 * @param advisingCase - The stored case.
 * @returns STUDENT for the case's own student, OWNER for the user who owns the case, otherwise
 *   REVIEWER. The caller must already have checked that the user may view the student.
 */
export function caseActorOf(
  actor: { readonly userId: UserId; readonly studentUserId: UserId | null },
  advisingCase: Pick<AdvisingCase, 'ownerUserId'>,
): CaseActor {
  // SECURITY: the relationship comes from the session and the stored case, never the request.
  if (actor.studentUserId === actor.userId) {
    return CaseActor.Student;
  }
  return advisingCase.ownerUserId === actor.userId ? CaseActor.Owner : CaseActor.Reviewer;
}

/**
 * Tells whether the actor could ever take this action on a case, in any status. The service
 * answers NOT_FOUND when it is false (a student claiming, a non-owner resolving, an advisor
 * withdrawing) and a plain refusal when only the status is wrong (acting on a RESOLVED case).
 *
 * @param action - What the actor wants to do.
 * @param actor - What the session's user is to the case.
 * @returns True when some status allows this actor the action. An owner may also attempt what
 *   any reviewer may.
 */
export function mayAttemptCaseAction(action: CaseAction, actor: CaseActor): boolean {
  const kinds: readonly CaseActor[] =
    actor === CaseActor.Owner ? [CaseActor.Owner, CaseActor.Reviewer] : [actor];
  return TRANSITIONS.some((row) => row.action === action && kinds.includes(row.actor));
}

/** The statuses in which a case holds its plan's single open slot. */
export type LiveCaseStatus = typeof CaseStatus.Open | typeof CaseStatus.InReview;

/**
 * Tells whether a case in this status still holds its plan's single open slot.
 *
 * @param status - The case's status.
 * @returns True for OPEN and IN_REVIEW; false for RESOLVED and WITHDRAWN.
 */
export function isLiveCaseStatus(status: CaseStatus): status is LiveCaseStatus {
  return status === CaseStatus.Open || status === CaseStatus.InReview;
}
