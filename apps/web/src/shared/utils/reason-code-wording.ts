/**
 * @file Fixed student-facing wording for every reason code: what it means and the next step.
 * @module @caa/web/shared/utils/reason-code-wording
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReasonCode } from '@caa/domain';

/** Plain-language wording for one reason code. */
export interface ReasonWording {
  /** What the code means for the student, in one or two sentences. */
  readonly explanation: string;
  /** What the student can do next. Always names a human route when the app can't resolve it. */
  readonly nextStep: string;
}

const ASK_ADVISOR_TO_CONFIRM = 'Ask your advisor to confirm this before you rely on it.';

// SAFETY: explanations come only from this fixed map, keyed by the API's reason code, never
// from free text (planning/10), so a code can't be reworded into a stronger claim than it makes.
/** Wording for every {@link ReasonCode}. The type requires an entry for each code. */
export const REASON_CODE_WORDING: Readonly<Record<ReasonCode, ReasonWording>> = {
  MIN_GRADE_NOT_MET: {
    explanation: 'The grade earned is below the minimum grade this rule requires.',
    nextStep: 'Ask your advisor about retaking the course or other ways to meet this rule.',
  },
  GRADE_SCHEME_MISMATCH: {
    explanation: 'The grade uses a grading scheme that can’t be compared with the required grade.',
    nextStep: 'An advisor needs to confirm whether this grade meets the rule.',
  },
  PASS_EQUIVALENCE_UNDEFINED: {
    explanation: 'The grade is a Pass, and the policy doesn’t say whether Pass meets the minimum.',
    nextStep: 'An advisor needs to confirm whether the Pass grade counts.',
  },
  GRADE_NOT_RANKED: {
    explanation: 'The grade isn’t in the institution’s grade order, so it can’t be compared.',
    nextStep: 'An advisor needs to confirm how this grade is treated.',
  },
  PASSING_GRADE_UNDEFINED: {
    explanation: 'The policy doesn’t say which grades count as passing for this rule.',
    nextStep: 'An advisor needs to confirm whether the grade counts as passing.',
  },
  GRADE_NOT_RECORDED: {
    explanation: 'The attempt that counts has no grade recorded yet.',
    nextStep: 'Check again after the grade is posted, or ask your advisor.',
  },
  IN_PROGRESS_MIN_GRADE: {
    explanation:
      'This depends on a course you are taking now. It is met only if you earn the required grade.',
    nextStep: 'Earn at least the grade shown in the evidence, then check again after grades post.',
  },
  PROGRESSION_NOT_PERMITTED: {
    explanation: 'The institution doesn’t allow planning on a course that is still in progress.',
    nextStep: 'Plan this course after the in-progress course is graded, or ask your advisor.',
  },
  PENDING_TRANSFER: {
    explanation:
      'The only matching credit is a transfer course still being evaluated. Pending transfer credit is not counted as earned.',
    nextStep: 'Wait for the transfer evaluation to finish, or ask your advisor about its status.',
  },
  INCOMPLETE_ATTEMPT: {
    explanation: 'An attempt at this course has an incomplete grade, so the outcome isn’t settled.',
    nextStep: 'Check again after the final grade is recorded, or ask your advisor.',
  },
  NO_QUALIFYING_ATTEMPT: {
    explanation: 'The record has no course attempt that meets this rule.',
    nextStep: 'Complete the required course first, or ask your advisor about alternatives.',
  },
  REPEAT_POLICY_UNDEFINED: {
    explanation: 'The course was repeated, and the policy doesn’t say which attempt counts.',
    nextStep: 'An advisor needs to confirm which attempt counts.',
  },
  REPEAT_ORDER_UNDETERMINED: {
    explanation:
      'The course was repeated, and the record doesn’t have enough information to tell which attempt counts.',
    nextStep: 'An advisor needs to confirm which attempt counts.',
  },
  COURSE_NOT_IN_CATALOG: {
    explanation:
      'A course on the record isn’t in the catalog, so it can’t be matched to this rule.',
    nextStep: 'Ask your advisor to check how this course appears on your record.',
  },
  UNSUPPORTED_RULE: {
    explanation: 'This rule has conditions the planner can’t interpret, so it isn’t decided here.',
    nextStep: 'Ask your advisor to review this rule for you.',
  },
  AUDIT_STALE: {
    explanation:
      'Your degree audit is older than your latest record, so it may not show recent changes.',
    nextStep: `Treat these results as needing verification until the audit is refreshed. ${ASK_ADVISOR_TO_CONFIRM}`,
  },
  AUDIT_AMBIGUOUS: {
    explanation:
      'The degree audit can’t be tied to your current record, or it doesn’t settle this requirement.',
    nextStep: `Treat these results as needing verification. ${ASK_ADVISOR_TO_CONFIRM}`,
  },
  AUDIT_PROGRAM_MISMATCH: {
    explanation:
      'The degree audit is for a different program or catalog than your record shows, or your record doesn’t state one.',
    nextStep: `Treat these results as needing verification. Ask your advisor to confirm your program and catalog.`,
  },
  REQUIREMENT_ALREADY_SATISFIED: {
    explanation: 'The requirement this course would count toward is already complete.',
    nextStep: 'Choose a course for a requirement you still need, or ask your advisor.',
  },
  REQUIREMENT_IN_PROGRESS: {
    explanation:
      'The requirement is already in progress. This course counts only if your current courses don’t complete it.',
    nextStep: 'Check again after your current grades post, or ask your advisor.',
  },
  NOT_APPLICABLE: {
    explanation: 'Your audit doesn’t list this course for a requirement you still need.',
    nextStep: 'Choose a course listed for one of your requirements, or ask your advisor.',
  },
  ALLOCATION_CONFLICT: {
    explanation:
      'Some courses in this set compete for the same requirement, and it doesn’t let them count twice.',
    nextStep: 'Remove one of the competing courses named in the evidence, or ask your advisor.',
  },
  CREDIT_LIMIT_EXCEEDED: {
    explanation: 'The total credits are above the term’s maximum load.',
    nextStep: 'Remove a course, or ask your advisor about taking a higher load.',
  },
  CREDIT_BELOW_MINIMUM: {
    explanation: 'The total credits are below the term’s minimum load.',
    nextStep: 'Add a course, or ask your advisor whether a lighter load is allowed for you.',
  },
  VARIABLE_CREDIT_UNSELECTED: {
    explanation:
      'A course in this set has a variable credit value and none was chosen, so the total can’t be counted.',
    nextStep: 'Ask your advisor which credit value to plan for that course.',
  },
  CREDIT_BOUNDS_UNDEFINED: {
    explanation:
      'The institution hasn’t published this term’s minimum and maximum load, so the total can’t be compared.',
    nextStep: 'Ask your advisor about the credit load limits for this term.',
  },
  MEETING_CONFLICT: {
    explanation: 'Two meetings in this schedule overlap on days they both meet.',
    nextStep:
      'Choose a different section for one of the courses named in the evidence, or ask your advisor.',
  },
  TRANSITION_TIME_INSUFFICIENT: {
    explanation:
      'Two meetings are on different campuses, and the time between them is shorter than the travel time the institution requires.',
    nextStep:
      'Choose sections with more time between them or on the same campus, or ask your advisor.',
  },
  TRANSITION_TIME_UNDEFINED: {
    explanation:
      'Two meetings on different campuses fall on the same day, and the institution hasn’t set the travel time between those campuses. It isn’t assumed to be enough.',
    nextStep:
      'Treat this schedule as needing verification. Ask your advisor or the registrar whether there is enough time to travel between these meetings.',
  },
  MEETING_TIME_UNKNOWN: {
    explanation:
      'A meeting’s days or times haven’t been announced yet, so a conflict with another meeting or with a time you marked unavailable can’t be ruled out.',
    nextStep:
      'Treat this schedule as needing verification. Check again after the times are published, or ask your advisor or the registrar.',
  },
  MEETING_LOCATION_UNKNOWN: {
    explanation:
      'A meeting’s location hasn’t been announced yet, so travel time between campuses and your campus choices can’t be checked.',
    nextStep:
      'Treat this schedule as needing verification. Check again after the location is published, or ask your advisor or the registrar.',
  },
  UNAVAILABLE_TIME_CONFLICT: {
    explanation: 'A meeting falls in a time you marked as unavailable.',
    nextStep:
      'Choose a different section, change your unavailable times if they can move, or ask your advisor.',
  },
  MODALITY_NOT_ALLOWED: {
    explanation: 'A section is taught in a way you didn’t allow, such as in person or online.',
    nextStep:
      'Choose a section taught in a way you allowed, change your choices, or ask your advisor.',
  },
  CAMPUS_NOT_ALLOWED: {
    explanation: 'A meeting is on a campus you didn’t allow.',
    nextStep:
      'Choose a section on a campus you allowed, change your campus choices, or ask your advisor.',
  },
  LINKED_SECTION_UNAVAILABLE: {
    explanation:
      'A section needs a linked part, such as a lab, and no section of that part has been published.',
    nextStep:
      'Treat this schedule as needing verification. Ask your advisor or the registrar when the linked section will be offered.',
  },
  SECTION_DATA_MISSING: {
    explanation:
      'The term’s published schedule has no sections for a course you asked for, so it can’t be scheduled here.',
    nextStep:
      'Treat this as needing verification. Ask your advisor or the registrar whether the course is offered this term.',
  },
};

/**
 * Looks up the fixed wording for a reason code.
 *
 * @param code - Reason code from an API result.
 * @returns Its explanation and next step.
 */
export function describeReason(code: ReasonCode): ReasonWording {
  return REASON_CODE_WORDING[code];
}
