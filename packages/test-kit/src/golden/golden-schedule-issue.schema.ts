/**
 * @file One expected schedule issue (#266), as an adjudicator states it: the reason, the
 *   sections it names, and the facts that prove it. Shared by section-pair check cases and
 *   solver cases.
 * @module @caa/test-kit/golden/golden-schedule-issue-schema
 * @requirement FR-07
 * @requirement FR-10
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import {
  CampusIdSchema,
  CheckKind,
  CheckState,
  CourseIdSchema,
  ReasonCode,
  SCHEDULE_REASON_STATE,
  type ScheduleReasonCode,
  SectionIdSchema,
} from '@caa/domain';

/** The schedule reason codes (#266), in the order `SCHEDULE_REASON_STATE` lists them. */
const SCHEDULE_REASON_CODES = Object.keys(SCHEDULE_REASON_STATE) as [
  ScheduleReasonCode,
  ...ScheduleReasonCode[],
];

/** How many sections each schedule reason names: `[least, most]`. */
const SECTION_COUNT: Readonly<Record<ScheduleReasonCode, readonly [number, number]>> = {
  [ReasonCode.MeetingConflict]: [1, 2],
  [ReasonCode.TransitionTimeInsufficient]: [1, 2],
  [ReasonCode.TransitionTimeUndefined]: [1, 2],
  [ReasonCode.MeetingTimeUnknown]: [1, 2],
  [ReasonCode.MeetingLocationUnknown]: [1, 2],
  [ReasonCode.UnavailableTimeConflict]: [1, 1],
  [ReasonCode.ModalityNotAllowed]: [1, 1],
  [ReasonCode.CampusNotAllowed]: [1, 1],
  [ReasonCode.LinkedSectionUnavailable]: [1, 1],
  [ReasonCode.SectionDataMissing]: [0, 0],
};

/** UNKNOWN reasons a schedule check may carry with no issue: the credit load decides them. */
const CREDIT_LOAD_UNKNOWN_REASONS: ReadonlySet<string> = new Set([
  ReasonCode.VariableCreditUnselected,
  ReasonCode.CreditBoundsUndefined,
]);

/**
 * Returns whether IDs are distinct and ascending by UTF-16 code unit, the order the tie-break
 * key uses (ADR-0010 §4), so two equal sets are always written the same way.
 *
 * @param ids - The IDs.
 * @returns `true` when each ID sorts strictly after the one before it.
 */
export function isAscendingIds(ids: readonly string[]): boolean {
  return ids.every((id, index) => index === 0 || (ids[index - 1] ?? '') < id);
}

/**
 * One schedule issue the engine must report (#266), read by what an adjudicator can state: its
 * reason, the sections it names, and the facts that prove it. A fact left out isn't compared.
 */
export const ExpectedScheduleIssueSchema = z
  .strictObject({
    reasonCode: z.enum(SCHEDULE_REASON_CODES),
    /** Every section the issue names, ascending; empty only for `SECTION_DATA_MISSING`. */
    sectionIds: z.array(SectionIdSchema).max(2).readonly(),
    /** The course with no section, or the linked component's course. */
    courseId: CourseIdSchema.optional(),
    /** The dates both meetings share: first, last, and the weekdays, ascending by name. */
    sharedDates: z
      .strictObject({
        firstDate: z.iso.date(),
        lastDate: z.iso.date(),
        weekdays: z.array(z.string().min(1)).min(1).readonly(),
      })
      .readonly()
      .optional(),
    fromCampusId: CampusIdSchema.optional(),
    toCampusId: CampusIdSchema.optional(),
    /** Minutes the table requires, or `null` when the pair isn't configured. */
    requiredMinutes: z.number().int().nonnegative().nullable().optional(),
    availableMinutes: z.number().int().nonnegative().optional(),
    /** Index of the hard constraint the issue breaks, in the request's constraint list. */
    constraintIndex: z.number().int().nonnegative().optional(),
  })
  .refine((issue) => isAscendingIds(issue.sectionIds), {
    message: 'sectionIds must be distinct and ascending',
    path: ['sectionIds'],
  })
  .refine(
    (issue) => {
      const [least, most] = SECTION_COUNT[issue.reasonCode];
      return issue.sectionIds.length >= least && issue.sectionIds.length <= most;
    },
    { message: 'sectionIds must name as many sections as the reason does', path: ['sectionIds'] },
  )
  .refine(
    (issue) =>
      (issue.reasonCode !== ReasonCode.SectionDataMissing &&
        issue.reasonCode !== ReasonCode.LinkedSectionUnavailable) ||
      issue.courseId !== undefined,
    { message: 'A missing section or link names its course', path: ['courseId'] },
  )
  .refine((issue) => isAscendingIds(issue.sharedDates?.weekdays ?? []), {
    message: 'sharedDates.weekdays must be distinct and ascending',
    path: ['sharedDates', 'weekdays'],
  })
  .readonly();

/** One expected schedule issue. */
export type ExpectedScheduleIssue = z.infer<typeof ExpectedScheduleIssueSchema>;

/** Raw input accepted for {@link ExpectedScheduleIssueSchema}. */
export type ExpectedScheduleIssueInput = z.input<typeof ExpectedScheduleIssueSchema>;

/** The parts of an expected check its schedule issues must explain. */
interface ExplainedCheck {
  readonly kind: string;
  readonly state: string;
  readonly reasonCode: string | null;
}

/**
 * Returns whether a check's issues explain it exactly as the domain's
 * `scheduleIssuesExplainCheck` (`CheckResultSchema`, #266) requires: PASS has none; any other
 * state has issues whose reasons all mean that state, and the check's own reason is one of
 * them, unless the check is UNKNOWN for an undecided credit load (`VARIABLE_CREDIT_UNSELECTED`
 * or `CREDIT_BOUNDS_UNDEFINED`), which needs no issue of its own reason and may have none. So a
 * CONDITIONAL schedule check is always rejected. Only a schedule check carries issues here.
 *
 * @param check - The expected check.
 * @param issues - Its expected issues.
 * @returns `false` when the issues don't support the state and reason.
 */
export function issuesExplainCheck(
  check: ExplainedCheck,
  issues: readonly ExpectedScheduleIssue[],
): boolean {
  if (check.kind !== CheckKind.ScheduleFeasibility || check.state === CheckState.Pass) {
    return issues.length === 0;
  }
  const isUnknownLoad =
    check.state === CheckState.Unknown && CREDIT_LOAD_UNKNOWN_REASONS.has(check.reasonCode ?? '');
  return (
    issues.every((issue) => SCHEDULE_REASON_STATE[issue.reasonCode] === check.state) &&
    (isUnknownLoad || issues.some((issue) => issue.reasonCode === check.reasonCode))
  );
}
