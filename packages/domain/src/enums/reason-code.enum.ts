/**
 * @file Closed registry of reason codes that explain every non-passing check.
 * @module @caa/domain/enums/reason-code
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

/**
 * Why a check did not pass. Every FAIL, UNKNOWN, or CONDITIONAL result carries exactly one of
 * these codes, so the UI renders a consistent explanation instead of free text.
 *
 * Grades:
 * - `MIN_GRADE_NOT_MET`: the qualifying attempt's grade is below the required minimum.
 * - `GRADE_SCHEME_MISMATCH`: the grade's scheme can't be compared with the required grade.
 * - `PASS_EQUIVALENCE_UNDEFINED`: a `P` grade meets a minimum only if policy says so, and it
 *   doesn't say.
 * - `GRADE_NOT_RANKED`: the grade is missing from the institution's grade order, so it can't
 *   be ranked.
 * - `PASSING_GRADE_UNDEFINED`: the rule accepts any passing completion, but policy doesn't say
 *   which letter grades pass (no `lowestPassingLetterGrade`), so only a ranked `F` is decided.
 * - `GRADE_NOT_RECORDED`: the attempt that counts has no recorded grade, so the grade can't be
 *   checked.
 *
 * Attempts:
 * - `IN_PROGRESS_MIN_GRADE`: satisfied only if the in-progress attempt earns the minimum grade.
 * - `PROGRESSION_NOT_PERMITTED`: the institution doesn't allow planning on in-progress work.
 * - `PENDING_TRANSFER`: the only qualifying credit is a transfer still under evaluation.
 * - `INCOMPLETE_ATTEMPT`: an attempt for this course has a deferred (incomplete) grade, so the
 *   outcome can't be settled until it's recorded.
 * - `NO_QUALIFYING_ATTEMPT`: no attempt of the course or an equivalent qualifies.
 * - `REPEAT_POLICY_UNDEFINED`: the course was repeated and policy doesn't say which attempt
 *   counts.
 * - `REPEAT_ORDER_UNDETERMINED`: the repeat policy can't pick one attempt, because terms or
 *   grades are missing, unranked, or tied.
 * - `COURSE_NOT_IN_CATALOG`: an attempt names a course the catalog doesn't contain.
 *
 * Rules and audit:
 * - `UNSUPPORTED_RULE`: the source rule has semantics the app can't represent.
 * - `PREREQUISITE_RULE_MISSING` (UNKNOWN only): the pinned ruleset holds no prerequisite rule
 *   for the course, not even an explicit `NONE`, so whether it has prerequisites is unknown.
 * - `AUDIT_STALE`: the degree audit is older than the student record it must reflect.
 * - `AUDIT_AMBIGUOUS`: the audit doesn't settle the requirement, or the audit wasn't run against
 *   the pinned student record: it is for another tenant or student, it ran against another
 *   snapshot that isn't older than the pinned one, or the pinned record is older than the
 *   audit's record time by more than the allowed skew. An API response never carries it for
 *   another tenant's or student's audit: the service refuses that case and returns no audit
 *   data (the academic-summary contract's SECURITY note).
 * - `AUDIT_PROGRAM_MISMATCH`: the audit's program or catalog differs from the student record's,
 *   or the record doesn't state one, so the audit's requirement states may not describe the
 *   student's current program and need verification.
 * - `REQUIREMENT_ALREADY_SATISFIED`: the requirement is already complete.
 * - `REQUIREMENT_IN_PROGRESS`: the requirement is in progress; this course applies only if the
 *   in-progress work does not satisfy it.
 * - `NOT_APPLICABLE`: the course doesn't apply to the requirement.
 *
 * Candidate sets:
 * - `ALLOCATION_CONFLICT`: one course is counted toward requirements that don't allow reuse.
 * - `CREDIT_LIMIT_EXCEEDED`: the plan exceeds the term's maximum credit load.
 * - `CREDIT_BELOW_MINIMUM`: the plan is under the term's minimum credit load.
 * - `VARIABLE_CREDIT_UNSELECTED`: a variable-credit course has no chosen credit value.
 * - `CREDIT_BOUNDS_UNDEFINED`: the credit-load check can't compare the plan with the term's
 *   load limits, because the institution hasn't supplied them (`AcademicPolicy.termCreditBounds`
 *   is `null`). The check is UNKNOWN, never a PASS against an assumed default load.
 *
 * Schedules (`SCHEDULE_FEASIBILITY` checks; ADR-0010). Each comes with a matching
 * `ScheduleIssue` in the check's evidence:
 * - `MEETING_CONFLICT` (FAIL): two meetings of the option overlap on a date they share.
 * - `TRANSITION_TIME_INSUFFICIENT` (FAIL): the gap between meetings on two campuses is shorter
 *   than the institution's required travel time (AC08).
 * - `TRANSITION_TIME_UNDEFINED` (UNKNOWN): meetings on two campuses share a date, and the
 *   institution hasn't configured the travel time between them. Never assumed to be zero.
 * - `MEETING_TIME_UNKNOWN` (UNKNOWN): a meeting's days or time are to be announced, so a
 *   conflict or a hard unavailable time can't be ruled out.
 * - `MEETING_LOCATION_UNKNOWN` (UNKNOWN): a meeting's location is to be announced, so travel
 *   time or a hard campus constraint can't be checked.
 * - `UNAVAILABLE_TIME_CONFLICT` (FAIL): a meeting falls in a time the student marked as a hard
 *   unavailable time.
 * - `MODALITY_NOT_ALLOWED` (FAIL): a section's delivery mode is outside the student's hard
 *   allowed modalities.
 * - `CAMPUS_NOT_ALLOWED` (FAIL): a meeting is on a campus outside the student's hard allowed
 *   campuses.
 * - `LINKED_SECTION_UNAVAILABLE` (UNKNOWN): a section requires a linked component (such as a
 *   lab) for which the registrar published no permitted section.
 * - `SECTION_DATA_MISSING` (UNKNOWN): a requested course has no section in the term's published
 *   section data.
 * - `LINKED_COURSE_NOT_CHECKED` (UNKNOWN): a linked section adds a course that this check didn't
 *   verify.
 */
export const ReasonCode = {
  MinGradeNotMet: 'MIN_GRADE_NOT_MET',
  GradeSchemeMismatch: 'GRADE_SCHEME_MISMATCH',
  PassEquivalenceUndefined: 'PASS_EQUIVALENCE_UNDEFINED',
  GradeNotRanked: 'GRADE_NOT_RANKED',
  PassingGradeUndefined: 'PASSING_GRADE_UNDEFINED',
  GradeNotRecorded: 'GRADE_NOT_RECORDED',
  InProgressMinGrade: 'IN_PROGRESS_MIN_GRADE',
  ProgressionNotPermitted: 'PROGRESSION_NOT_PERMITTED',
  PendingTransfer: 'PENDING_TRANSFER',
  IncompleteAttempt: 'INCOMPLETE_ATTEMPT',
  NoQualifyingAttempt: 'NO_QUALIFYING_ATTEMPT',
  RepeatPolicyUndefined: 'REPEAT_POLICY_UNDEFINED',
  RepeatOrderUndetermined: 'REPEAT_ORDER_UNDETERMINED',
  CourseNotInCatalog: 'COURSE_NOT_IN_CATALOG',
  UnsupportedRule: 'UNSUPPORTED_RULE',
  PrerequisiteRuleMissing: 'PREREQUISITE_RULE_MISSING',
  AuditStale: 'AUDIT_STALE',
  AuditAmbiguous: 'AUDIT_AMBIGUOUS',
  AuditProgramMismatch: 'AUDIT_PROGRAM_MISMATCH',
  RequirementAlreadySatisfied: 'REQUIREMENT_ALREADY_SATISFIED',
  RequirementInProgress: 'REQUIREMENT_IN_PROGRESS',
  NotApplicable: 'NOT_APPLICABLE',
  AllocationConflict: 'ALLOCATION_CONFLICT',
  CreditLimitExceeded: 'CREDIT_LIMIT_EXCEEDED',
  CreditBelowMinimum: 'CREDIT_BELOW_MINIMUM',
  VariableCreditUnselected: 'VARIABLE_CREDIT_UNSELECTED',
  CreditBoundsUndefined: 'CREDIT_BOUNDS_UNDEFINED',
  MeetingConflict: 'MEETING_CONFLICT',
  TransitionTimeInsufficient: 'TRANSITION_TIME_INSUFFICIENT',
  TransitionTimeUndefined: 'TRANSITION_TIME_UNDEFINED',
  MeetingTimeUnknown: 'MEETING_TIME_UNKNOWN',
  MeetingLocationUnknown: 'MEETING_LOCATION_UNKNOWN',
  UnavailableTimeConflict: 'UNAVAILABLE_TIME_CONFLICT',
  ModalityNotAllowed: 'MODALITY_NOT_ALLOWED',
  CampusNotAllowed: 'CAMPUS_NOT_ALLOWED',
  LinkedSectionUnavailable: 'LINKED_SECTION_UNAVAILABLE',
  SectionDataMissing: 'SECTION_DATA_MISSING',
  LinkedCourseNotChecked: 'LINKED_COURSE_NOT_CHECKED',
} as const;

/** Union of every {@link ReasonCode} value. */
export type ReasonCode = (typeof ReasonCode)[keyof typeof ReasonCode];

/** Runtime schema for {@link ReasonCode}. */
export const ReasonCodeSchema = z.enum(ReasonCode);
