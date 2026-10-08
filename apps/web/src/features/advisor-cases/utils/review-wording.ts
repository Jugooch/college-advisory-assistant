/**
 * @file Fixed wording for the advisor's review screens: queue status and routing, who acted, how a
 * case stands, the resolution options, and what each outcome means. A resolution is advice, not
 * an official waiver or approval (ADR-0013 §6, planning/08).
 * @module @caa/web/features/advisor-cases/utils/review-wording
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { CaseAction, type CaseReason, type CaseResolution, CaseStatus, Role } from '@caa/domain';

import type { QueueFilter } from './queue-filter';

/** Heading shown when the API says the case isn't available (404), for a revoked assignment too. */
export const NO_ACCESS_HEADING = 'You no longer have access to this student';

/** Explains a 404 on a case and what to do. A missing case and a revoked one look the same. */
export const NO_ACCESS_EXPLANATION =
  'This case is not available to you. Your access to this student may have been removed, or the case may not exist. The case is no longer shown here.';

/** Next step after a 404 on a case. */
export const NO_ACCESS_NEXT_STEP =
  'Go back to the review queue. If you think this is a mistake, ask an administrator to check your assignments.';

/** Heading shown when a signed-in user is not an advisor or an admin. */
export const NOT_AN_ADVISOR_HEADING = 'This area is for advisors';

/** Explains why a student-only session sees no queue. */
export const NOT_AN_ADVISOR_EXPLANATION =
  'The review queue is only for advisors and administrators. The server also checks this on every request.';

/** Next step for a student-only session. */
export const NOT_AN_ADVISOR_NEXT_STEP =
  'Go back to the home page to open your own record, or sign in with an advisor account.';

/** Heading of the notice after a race with another reviewer (409). */
export const CASE_CHANGED_HEADING = 'Someone else updated this case';

/** Explains the race and that nothing you submitted was applied. */
export const CASE_CHANGED_EXPLANATION =
  'Another person acted on this case after you opened it, so your action was not applied.';

/** Next step after the race: the page has been refreshed. */
export const CASE_CHANGED_NEXT_STEP =
  'This page has been refreshed with the latest version. Read it, then take an action if one is still available.';

/** Shown when a review form did not parse, so nothing was sent. */
export const REVIEW_FORM_REJECTED =
  'This request could not be read, so nothing was sent. Check the form and try again.';

/** The resolve form's statement of what a resolution is and who sees the note. */
export const RESOLVE_DISCLAIMER =
  'The student can read your note. Resolving a case is advice only: it is not an official waiver, exception, or approval. It does not change any record or give the student permission to enroll.';

/** Shown when no action is available to this session on the case. */
export const NO_ACTIONS_AVAILABLE =
  'No actions are available to you on this case right now. You can still read it. If someone else is reviewing it, only they can change it.';

/** Shown on the reason line of a source discrepancy report. */
export const DISCREPANCY_CHANGES_NOTHING =
  'The student reported a problem with their record. Reviewing it changes no official record, and it is not a request for a waiver or an exception.';

/** Shown in place of a plan on a source discrepancy case. */
export const NO_PLAN_ON_REPORT = 'No plan is attached to this report.';

const REVIEW_REASON_LABELS: Readonly<Record<CaseReason, string>> = {
  PLAN_REVIEW: 'Plan review',
  NEEDS_VERIFICATION: 'Checks that could not be verified',
  SOURCE_DISCREPANCY: 'Problem reported with the record',
};

/**
 * Names a case reason from the reviewer's side. The student's wording is first person, so it
 * isn't reused here.
 *
 * @param reason - The reason from the API.
 * @returns A short label. It never contains a user ID or a name.
 */
export function describeReviewReason(reason: CaseReason): string {
  return REVIEW_REASON_LABELS[reason];
}

const QUEUE_STATUS_LABELS: Readonly<Record<CaseStatus, string>> = {
  OPEN: 'Open',
  IN_REVIEW: 'In review',
  RESOLVED: 'Resolved',
  WITHDRAWN: 'Withdrawn by the student',
};

/**
 * Names a case status for the queue and the review screen.
 *
 * @param status - The status from the API.
 * @returns A short label that does not rely on color.
 */
export function describeQueueStatus(status: CaseStatus): string {
  return QUEUE_STATUS_LABELS[status];
}

/**
 * Says how a case stands and who holds it. It describes the case; which actions you may take
 * comes only from the API's `allowedActions`.
 *
 * @param status - The status from the API.
 * @param owner - The case owner as the API returned it.
 * @returns A sentence.
 */
export function describeCaseStanding(
  status: CaseStatus,
  owner: { readonly role: Role; readonly isYou: boolean } | null,
): string {
  switch (status) {
    case CaseStatus.Open:
      return 'No one has claimed this case yet.';
    case CaseStatus.InReview:
      return owner?.isYou === true
        ? 'You are reviewing this case.'
        : `${describeOwner(owner)} is reviewing this case. Only the reviewer can change it.`;
    case CaseStatus.Resolved:
      return `${owner?.isYou === true ? 'You' : describeOwner(owner)} resolved this case. The student can see the note, if there is one.`;
    case CaseStatus.Withdrawn:
      return 'The student withdrew this case, so no review is needed.';
  }
}

/**
 * Names the owner by role. No ID or name is ever shown.
 *
 * @param owner - The owner, or `null` when no one owns the case.
 * @returns For example `Another advisor`.
 */
function describeOwner(owner: { readonly role: Role; readonly isYou: boolean } | null): string {
  if (owner === null) {
    return 'No one';
  }
  return owner.isYou ? 'You' : describeReviewActor(owner.role, false);
}

/**
 * Names who took an action, from the advisor's side. No ID or name is ever shown.
 *
 * @param role - The role the actor acted as.
 * @param isYou - Whether the signed-in user took the action.
 * @returns For example `You`, `Another advisor`, or `The student`.
 */
export function describeReviewActor(role: Role, isYou: boolean): string {
  if (isYou) {
    return 'You';
  }
  switch (role) {
    case Role.Advisor:
      return 'Another advisor';
    case Role.Admin:
      return 'An administrator';
    case Role.Student:
      return 'The student';
  }
}

/** Each resolution option's label, written for the person choosing it. */
const RESOLUTION_OPTION_LABELS: Readonly<Record<CaseResolution, string>> = {
  PLAN_REVIEWED: 'I reviewed this',
  STUDENT_ACTION_NEEDED: 'The student has a next step',
  REFERRED_OUTSIDE_APP: 'I am following up outside this app',
};

/**
 * Names a resolution option for the form and the history.
 *
 * @param resolution - The resolution code.
 * @returns A short label. None says a request was approved or granted.
 */
export function describeResolutionOption(resolution: CaseResolution): string {
  return RESOLUTION_OPTION_LABELS[resolution];
}

/** What a queue holds when a filter is chosen and nothing matches: the empty state's wording. */
export interface EmptyQueueWording {
  readonly heading: string;
  readonly explanation: string;
  readonly nextStep: string;
}

/**
 * Explains an empty queue and what to do next, for the filter in use.
 *
 * @param filter - The filter in use.
 * @returns A heading, an explanation, and a next step.
 */
export function describeEmptyQueue(filter: QueueFilter): EmptyQueueWording {
  switch (filter.kind) {
    case 'all':
      return {
        heading: 'No cases to review',
        explanation: 'There are no cases from your students right now.',
        nextStep:
          'Check back later. You get no email or message when a student asks for help, so open this page to see new cases.',
      };
    case 'unrouted':
      return {
        heading: 'No unrouted cases',
        explanation: 'Every open case belongs to a student who has an active advisor assignment.',
        nextStep: 'Choose another filter to see cases that are already routed to an advisor.',
      };
    case 'status':
      return {
        heading: `No ${describeQueueStatus(filter.status).toLowerCase()} cases`,
        explanation: 'No case with that status matches right now.',
        nextStep: 'Choose All cases or another status to see more.',
      };
  }
}

/** What the screen says after an action succeeded. */
export interface ReviewDoneWording {
  readonly message: string;
  readonly nextStep: string;
}

const BACK_TO_QUEUE = 'Go back to the review queue when you are ready for the next case.';

/**
 * Says what an action did and what to do next.
 *
 * @param action - The action that succeeded.
 * @returns The outcome message and the next step. Nothing says a request was approved.
 */
export function describeReviewDone(action: CaseAction): ReviewDoneWording {
  switch (action) {
    case CaseAction.Claim:
      return {
        message: 'You claimed this case. It is now in your review.',
        nextStep: 'Read the plan and the student’s note, then resolve the case or release it.',
      };
    case CaseAction.Release:
      return {
        message: 'You returned this case to the queue. Another advisor can claim it.',
        nextStep: BACK_TO_QUEUE,
      };
    case CaseAction.Resolve:
      return {
        message:
          'You resolved this case. The student can now read your note. It is advice, not an official waiver or approval.',
        nextStep: BACK_TO_QUEUE,
      };
    default:
      return { message: 'The case was updated.', nextStep: BACK_TO_QUEUE };
  }
}
