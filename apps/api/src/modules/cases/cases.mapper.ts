/**
 * @file Turns stored cases and events into the response views. A view names actors by role and
 * `isYou` only; no user ID, tenant, or name leaves this file.
 * @module @caa/api/modules/cases/cases.mapper
 * @requirement FR-12
 * @requirement FR-14
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type {
  CaseEventView,
  CaseListResponse,
  CaseQueueResponse,
  CaseView,
  PlanRevisionView,
} from '@caa/api-contract';
import {
  type Actor,
  type AdvisingCase,
  CaseAction,
  type CaseEvent,
  Role,
  type UserId,
} from '@caa/domain';

/** One row of the student's case list. */
export type CaseSummary = CaseListResponse['cases'][number];

/** Everything needed to show one case to one viewer. */
export interface CaseViewSource {
  readonly advisingCase: AdvisingCase;
  /** The case's events, oldest first. */
  readonly events: readonly CaseEvent[];
  /** The user linked to the case's student. */
  readonly studentUserId: UserId | null;
  /** The signed-in viewer. */
  readonly viewer: Actor;
  /** The frozen revision, or null for a source discrepancy. */
  readonly context: PlanRevisionView | null;
  /** From the case logic for the viewer. */
  readonly allowedActions: readonly CaseAction[];
}

/**
 * Names the role a user acted as. The case stores a user, not the role they held, so the
 * student is the user linked to the student record, the viewer is their own staff role, and any
 * other staff user is shown as an advisor.
 *
 * @param userId - The actor of an event, or the owner of the case.
 * @param source - The case and viewer being shown.
 * @returns The role to show.
 */
function roleOf(userId: UserId, source: CaseViewSource): Role {
  if (userId === source.studentUserId) {
    return Role.Student;
  }
  const isAdminOnly =
    userId === source.viewer.userId &&
    source.viewer.roles.includes(Role.Admin) &&
    !source.viewer.roles.includes(Role.Advisor);
  return isAdminOnly ? Role.Admin : Role.Advisor;
}

/**
 * Names the owner's role: the stored role of the latest CLAIM event, else the inferred role.
 *
 * @param ownerUserId - The case's owner.
 * @param source - The case, its events, and the viewer being shown.
 * @returns The role to show.
 */
function ownerRoleOf(ownerUserId: UserId, source: CaseViewSource): Role {
  const claim = source.events.findLast((event) => event.action === CaseAction.Claim);
  return claim?.actorRole ?? roleOf(ownerUserId, source);
}

/**
 * Maps one event to its view, with the actor as a role and `isYou`.
 *
 * @param event - The stored event.
 * @param source - The case and viewer being shown.
 * @returns The event view, with no actor ID.
 */
function toEventView(event: CaseEvent, source: CaseViewSource): CaseEventView {
  return {
    id: event.id,
    sequence: event.sequence,
    action: event.action,
    actorRole: event.actorRole ?? roleOf(event.actorUserId, source),
    isYou: event.actorUserId === source.viewer.userId,
    at: event.at,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    resolution: event.resolution,
    note: event.note,
  };
}

/**
 * Builds the case view for one viewer.
 *
 * @param source - The case, its events, the viewer, the frozen context, and the allowed actions.
 * @returns The case view; the owner is a role and `isYou`, never an ID.
 */
export function toCaseView(source: CaseViewSource): CaseView {
  const { advisingCase } = source;
  return {
    id: advisingCase.id,
    studentId: advisingCase.studentId,
    reason: advisingCase.reason,
    planRevisionId: advisingCase.planRevisionId,
    discrepancySubject: advisingCase.discrepancySubject,
    studentNote: advisingCase.studentNote,
    status: advisingCase.status,
    owner:
      advisingCase.ownerUserId === null
        ? null
        : {
            role: ownerRoleOf(advisingCase.ownerUserId, source),
            isYou: advisingCase.ownerUserId === source.viewer.userId,
          },
    createdAt: advisingCase.createdAt,
    lastSequence: advisingCase.lastSequence,
    events: source.events.map((event) => toEventView(event, source)),
    context: source.context,
    allowedActions: [...source.allowedActions],
  };
}

/**
 * Builds one row of the student's case list. No note, no owner.
 *
 * @param advisingCase - The stored case.
 * @returns The summary row.
 */
export function toCaseSummary(advisingCase: AdvisingCase): CaseSummary {
  return {
    id: advisingCase.id,
    reason: advisingCase.reason,
    planRevisionId: advisingCase.planRevisionId,
    discrepancySubject: advisingCase.discrepancySubject,
    status: advisingCase.status,
    createdAt: advisingCase.createdAt,
  };
}

/** One row of the advisor or admin queue. */
export type CaseQueueItem = CaseQueueResponse['cases'][number];

/**
 * Builds one queue row. Opaque IDs and case facts only: no note, no owner ID, no student name.
 *
 * @param advisingCase - The stored case.
 * @param options - The signed-in user's ID, and whether the student has an active assignment.
 * @returns The queue row.
 */
export function toCaseQueueItem(
  advisingCase: AdvisingCase,
  options: { readonly viewerUserId: UserId; readonly routed: boolean },
): CaseQueueItem {
  return {
    caseId: advisingCase.id,
    studentId: advisingCase.studentId,
    reason: advisingCase.reason,
    status: advisingCase.status,
    createdAt: advisingCase.createdAt,
    ownerIsYou: advisingCase.ownerUserId === options.viewerUserId,
    routed: options.routed,
  };
}
