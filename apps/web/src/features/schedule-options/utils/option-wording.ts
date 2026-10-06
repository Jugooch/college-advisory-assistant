/**
 * @file Fixed wording for schedule-search outcomes, the limitation codes, and unmet preferences.
 * It carries no claim of registration, seats, or approval.
 * @module @caa/web/features/schedule-options/utils/option-wording
 * @requirement FR-09
 * @requirement FR-10
 * @requirement FR-18
 * @requirement NFR-02
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type {
  ScheduleConstraintKind,
  ScheduleLimitation,
  ScheduleOutcome,
  UnmetPreference,
} from '@caa/domain';

import type { StatusTone } from '@/components/ui/status-badge';

/** How one search outcome is shown. */
export interface OutcomeDisplay {
  readonly heading: string;
  readonly label: string;
  readonly tone: StatusTone;
  readonly message: string;
  readonly nextStep: string;
}

// SAFETY: each outcome has its own wording. A timeout or an incomplete search is never described
// as "no schedule", and a found option never claims seats or a registration (ADR-0010 §5).
const OUTCOME_WORDING: Readonly<Record<ScheduleOutcome, OutcomeDisplay>> = {
  OPTIONS_FOUND: {
    heading: 'Schedule options found',
    label: 'Options found',
    tone: 'neutral',
    message:
      'Each option below was checked for the dimensions shown on its card. Open the evidence under any check to see what it rests on.',
    nextStep:
      'Compare the options, then ask your advisor to confirm the one you prefer before you act on it.',
  },
  NO_FEASIBLE_PLAN: {
    heading: 'No schedule fits these limits',
    label: 'No feasible plan',
    tone: 'negative',
    message:
      'The search finished and found no schedule that meets every required limit. The verified conflicts are listed below. They are not necessarily every conflict.',
    nextStep:
      'You can change the constraints you marked as preferred, or choose fewer courses. Required constraints stay required unless you change them yourself. Your advisor can help with the conflicts.',
  },
  SEARCH_TIMEOUT: {
    heading: 'The search stopped before it finished',
    label: 'Search timed out',
    tone: 'caution',
    message:
      'The search reached its work limit before it finished. This does not mean no schedule exists.',
    nextStep:
      'Try again with fewer courses or fewer constraints, or ask your advisor to look for a schedule with you.',
  },
  NEEDS_VERIFICATION: {
    heading: 'Schedule data needs verification',
    label: 'Needs verification',
    tone: 'caution',
    message:
      'Some of the information needed to build a schedule is missing or unconfirmed, so no schedule was produced. The items that couldn’t be resolved are listed below.',
    nextStep:
      'Ask your advisor or the registrar to confirm the missing information, then search again.',
  },
};

/** Shown above the options when the search stopped early but still produced options. */
export const INCOMPLETE_SEARCH_NOTICE =
  'These options were checked; others may exist. The search didn’t finish, so these may not be the best fit.';

/**
 * Describes a search outcome.
 *
 * @param outcome - The outcome from the API.
 * @returns Its heading, badge, message, and next step.
 */
export function describeOutcome(outcome: ScheduleOutcome): OutcomeDisplay {
  return OUTCOME_WORDING[outcome];
}

/** How one limitation code is shown. */
export interface LimitationDisplay {
  readonly label: string;
  readonly detail: string;
}

// SAFETY: seats and registration are always shown as not checked, from fixed codes (ADR-0010 §5).
const LIMITATION_WORDING: Readonly<Record<ScheduleLimitation, LimitationDisplay>> = {
  SEAT_AVAILABILITY_NOT_CHECKED: {
    label: 'Seat availability: not checked',
    detail: 'A section shown here may be full or reserved for other students.',
  },
  REGISTRATION_READINESS_NOT_CHECKED: {
    label: 'Registration readiness: not checked',
    detail: 'Holds, registration windows, and permissions were not looked at.',
  },
  NOT_REGISTERED: {
    label: 'Not a registration',
    detail: 'Viewing or keeping an option does not sign you up for any course.',
  },
};

/**
 * Describes a limitation code.
 *
 * @param code - The limitation code from the API.
 * @returns Its label and detail.
 */
export function describeLimitation(code: ScheduleLimitation): LimitationDisplay {
  return LIMITATION_WORDING[code];
}

const CONSTRAINT_WORDING: Readonly<Record<ScheduleConstraintKind, string>> = {
  UNAVAILABLE_TIME: 'A meeting falls in a time you marked as unavailable',
  CREDIT_RANGE: 'The total credits are outside the range you preferred',
  ALLOWED_MODALITIES: 'A section is taught in a way you didn’t prefer',
  ALLOWED_CAMPUSES: 'A meeting is on a campus you didn’t prefer',
};

/**
 * Describes an unmet preference.
 *
 * @param unmet - The unmet preference from the API.
 * @returns For example `Preference 2: A section is taught in a way you didn’t prefer`. A
 *   preference that depends on data still to be announced is said to be unknown, never met.
 */
export function describeUnmetPreference(unmet: UnmetPreference): string {
  const base = `Preference ranked ${String(unmet.priorityRank)}: ${CONSTRAINT_WORDING[unmet.kind]}`;
  return unmet.isDataUnknown
    ? `${base}. This can’t be ruled out because a value is still to be announced.`
    : `${base}.`;
}
