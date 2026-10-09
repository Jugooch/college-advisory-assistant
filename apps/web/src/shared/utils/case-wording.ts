/**
 * @file Fixed wording for advisor cases: status, reason, subject, resolution, and event actors.
 * A case is a request for review. Nothing here says a plan, waiver, exception, or registration
 * was approved; a resolution is "advice, not permission to enroll" (ADR-0013 §6).
 * @module @caa/web/shared/utils/case-wording
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type {
  CaseAction,
  CaseReason,
  CaseResolution,
  CaseStatus,
  DiscrepancySubject,
  Role,
} from '@caa/domain';

import type { StatusTone } from '@/components/ui/status-badge';

/** How one case status is shown: a label, what it means, and what the student does next. */
export interface CaseStatusDisplay {
  readonly label: string;
  readonly tone: StatusTone;
  readonly explanation: string;
  readonly nextStep: string;
}

const NO_MESSAGES = 'You won’t get an email or message, so check this page for updates.';

// SAFETY: no status wording says approved, granted, or registered. RESOLVED is advice only.
const STATUS_WORDING: Readonly<Record<CaseStatus, CaseStatusDisplay>> = {
  OPEN: {
    label: 'Waiting for an advisor',
    tone: 'neutral',
    explanation: 'Your case is in your advising team’s queue. No advisor has picked it up yet.',
    nextStep: `${NO_MESSAGES} If you need help now, contact your advisor directly.`,
  },
  IN_REVIEW: {
    label: 'An advisor is reviewing it',
    tone: 'neutral',
    explanation: 'An advisor on your advising team has picked up your case.',
    nextStep: `${NO_MESSAGES} If you need help now, contact your advisor directly.`,
  },
  RESOLVED: {
    label: 'Reviewed by an advisor',
    tone: 'neutral',
    explanation:
      'Your advisor has finished reviewing this case. Their note is below. It is advice, not permission to enroll.',
    nextStep:
      'Your plan and your record are unchanged. If something is still unclear, contact your advisor.',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    tone: 'neutral',
    explanation: 'You withdrew this case, so no one will review it.',
    nextStep: 'Open a new case if you still need help.',
  },
};

/** Shown with a resolved case. A resolution is never permission or an approval. */
export const ADVICE_NOT_PERMISSION = 'This is advice, not permission to enroll.';

/** Says who sees a submission and that nothing is sent outside the app. */
export const WHO_SEES_THIS =
  'Your assigned advising team will see this. No email or message is sent.';

/** Says what a plan-based submission leaves out. */
export const CHAT_NOT_SHARED = 'Your chat is not shared.';

/** Shown on a problem report: it changes no official record (FR-17). */
export const REPORT_CHANGES_NOTHING =
  'Reporting a problem doesn’t change your official records. It asks your advising team to look into it, and it is not a request for a waiver or an exception.';

/** Shown when the student already has an open case for the plan (409). */
export const OPEN_CASE_EXISTS = 'You already have an open case for this plan.';

/** Shown when a withdraw races a change to the case (409). */
export const CASE_CHANGED =
  'This case changed since you opened this page. Reload the page to see where it stands.';

/** Shown when a form didn't parse, so nothing was sent. */
export const FORM_REJECTED =
  'This request couldn’t be read, so nothing was sent. Check your note and try again.';

/** Shown for a source discrepancy case list row that has no plan. */
export const NO_PLAN_ATTACHED = 'No plan is attached to this report.';

/**
 * Describes a case status.
 *
 * @param status - The status from the API.
 * @returns Its label, tone, explanation, and next step.
 */
export function describeCaseStatus(status: CaseStatus): CaseStatusDisplay {
  return STATUS_WORDING[status];
}

const REASON_LABELS: Readonly<Record<CaseReason, string>> = {
  PLAN_REVIEW: 'Review my plan',
  NEEDS_VERIFICATION: 'Help with checks that couldn’t be verified',
  SOURCE_DISCREPANCY: 'A problem with my record',
};

/**
 * Names a case reason in plain language.
 *
 * @param reason - The reason from the API.
 * @returns A short label.
 */
export function describeCaseReason(reason: CaseReason): string {
  return REASON_LABELS[reason];
}

const SUBJECT_LABELS: Readonly<Record<DiscrepancySubject, string>> = {
  PROGRAM_OR_CATALOG: 'My program or catalog',
  COURSE_ATTEMPT: 'A course attempt on my record',
  AUDIT_REQUIREMENT: 'A requirement on my degree audit',
  SECTION: 'A course section',
};

/**
 * Names what a discrepancy report disputes.
 *
 * @param subject - The subject from the API.
 * @returns A short label.
 */
export function describeSubject(subject: DiscrepancySubject): string {
  return SUBJECT_LABELS[subject];
}

const RESOLUTION_LABELS: Readonly<Record<CaseResolution, string>> = {
  PLAN_REVIEWED: 'Your advisor reviewed this',
  STUDENT_ACTION_NEEDED: 'Your advisor says you have a next step',
  REFERRED_OUTSIDE_APP: 'Your advisor is following up outside this app',
};

/**
 * Names a resolution code. None of the labels says a request was approved or granted.
 *
 * @param resolution - The resolution from the API.
 * @returns A short label.
 */
export function describeResolution(resolution: CaseResolution): string {
  return RESOLUTION_LABELS[resolution];
}

/**
 * Names who took an action, from a role and whether it was the signed-in user. No ID or name is
 * ever shown.
 *
 * @param role - The role the actor acted as.
 * @param isYou - Whether the signed-in user took the action.
 * @returns For example `You` or `Your advisor`.
 */
export function describeActor(role: Role, isYou: boolean): string {
  if (isYou) {
    return 'You';
  }
  switch (role) {
    case 'ADVISOR':
      return 'Your advisor';
    case 'ADMIN':
      return 'An administrator';
    case 'STUDENT':
      return 'A student';
  }
}

const ACTION_LABELS: Readonly<Record<CaseAction, string>> = {
  CREATE: 'opened the case',
  CLAIM: 'started reviewing',
  RELEASE: 'returned the case to the queue',
  RESOLVE: 'finished reviewing',
  WITHDRAW: 'withdrew the case',
};

/**
 * Names an action as a past-tense phrase to follow the actor.
 *
 * @param action - The action from the API.
 * @returns For example `started reviewing`.
 */
export function describeAction(action: CaseAction): string {
  return ACTION_LABELS[action];
}
