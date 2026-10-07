/**
 * @file One schedule option: its section bundles, schedule and academic checks, and unmet preferences.
 * @module @caa/api-contract/contracts/schedule-option
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-09
 * @requirement FR-10
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import {
  AggregateStateSchema,
  CheckKind,
  type CheckResult,
  CheckResultSchema,
  CheckState,
  CourseIdSchema,
  deriveAggregateState,
  SectionSchema,
  UnmetPreferenceSchema,
} from '@caa/domain';

import { CourseCheckResultSchema, SetCheckResultsSchema } from './course-checks.contract';
import { MAX_SCHEDULE_OPTION_COURSES } from './schedule-options-request.contract';

/** Most options one response may carry (FR-18). */
export const MAX_SCHEDULE_OPTIONS = 3;

const SECTION_FIELDS = SectionSchema.unwrap().shape;

/**
 * Returns whether a list has no repeated values.
 *
 * @param values - Values to check.
 * @returns `true` when every value appears once.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * One section of a bundle, with the published fields the option card shows. Section data comes
 * from the pinned section snapshot, never from the model.
 */
export const ScheduledSectionSchema = z
  .object({
    sectionId: SECTION_FIELDS.id,
    courseId: SECTION_FIELDS.courseId,
    /** Display code such as `001` or `L01`. Never identity. */
    sectionCode: SECTION_FIELDS.sectionCode,
    modality: SECTION_FIELDS.modality,
    campusId: SECTION_FIELDS.campusId,
    startsOn: SECTION_FIELDS.startsOn,
    endsOn: SECTION_FIELDS.endsOn,
    meetings: SECTION_FIELDS.meetings,
    /**
     * Whether this section's course counts its own credits. `false` when the catalog includes
     * them in a linked course's total, such as a lab counted in its lecture (#211).
     */
    countsCredits: z.boolean(),
  })
  .readonly();

/**
 * The sections chosen for one requested course: the primary section first, then the linked
 * sections it requires, which may belong to other courses.
 */
export const SectionBundleSchema = z
  .object({
    /** The requested course this bundle schedules. */
    courseId: CourseIdSchema,
    sections: z.array(ScheduledSectionSchema).min(1).readonly(),
    /**
     * Credits the bundle adds to the load, in hundredths, counting only sections whose course
     * counts its own credits. `null` when unknown, for example an unselected variable value.
     */
    creditsCountedHundredths: z.number().int().nonnegative().nullable(),
  })
  .refine((bundle) => bundle.sections[0]?.courseId === bundle.courseId, {
    message: "The first section must be the requested course's primary section",
    path: ['sections'],
  })
  .refine((bundle) => isDistinct(bundle.sections.map((section) => section.sectionId)), {
    message: 'A bundle must not repeat a section',
    path: ['sections'],
  })
  .readonly();

/**
 * Builds a check-result schema that accepts only one check kind.
 *
 * @param kind - The kind the check must have.
 * @returns `CheckResultSchema` with the kind pinned, so every evidence rule still applies.
 */
function checkOfKind(kind: CheckKind): typeof CheckResultSchema {
  return CheckResultSchema.refine((check) => check.kind === kind, {
    message: `Expected a ${kind} check`,
    path: ['kind'],
  });
}

/** The option fields the cross-field rules read. */
interface ScheduleOptionShape {
  readonly scheduleFeasibility: CheckResult;
  readonly courseResults: readonly {
    readonly prerequisite: CheckResult | null;
    readonly applicability: CheckResult;
  }[];
  readonly linkedCourseResults: readonly {
    readonly prerequisite: CheckResult | null;
    readonly applicability: CheckResult;
  }[];
  readonly setResults: {
    readonly allocation: readonly CheckResult[];
    readonly creditLoad: CheckResult;
  };
}

/**
 * Lists every check of an option. A `null` prerequisite is not a check and isn't listed.
 * A missing rule row is an UNKNOWN `PREREQUISITE_RULE_MISSING` check, not `null` (ADR-0012).
 *
 * @param option - The option's checks.
 * @returns Every check result: schedule feasibility, then per-course, then linked-course, then
 *   set checks.
 */
function listOptionChecks(option: ScheduleOptionShape): readonly CheckResult[] {
  return [
    option.scheduleFeasibility,
    ...[...option.courseResults, ...option.linkedCourseResults].flatMap(
      ({ prerequisite, applicability }) =>
        prerequisite === null ? [applicability] : [prerequisite, applicability],
    ),
    ...option.setResults.allocation,
    option.setResults.creditLoad,
  ];
}

/**
 * Returns whether an option's bundle credits agree with its credit-load check: any `null`
 * bundle credit means the load is UNKNOWN, and a load total, when shown, is the exact sum of
 * the bundle credits.
 *
 * @param option - The bundles and the credit-load check.
 * @returns `false` when a load is decided over an unknown credit, or its total differs from
 *   the sum.
 */
function creditsAgreeWithLoad(option: {
  readonly bundles: readonly { readonly creditsCountedHundredths: number | null }[];
  readonly setResults: { readonly creditLoad: CheckResult };
}): boolean {
  const { creditLoad } = option.setResults;
  const credits = option.bundles.map((bundle) => bundle.creditsCountedHundredths);
  if (credits.some((value) => value === null)) {
    return creditLoad.state === CheckState.Unknown;
  }
  const total = creditLoad.evidence?.creditLoad?.totalCreditsHundredths;
  const sum = credits.reduce<number>((accumulated, value) => accumulated + (value ?? 0), 0);
  return total === undefined || total === sum;
}

/**
 * Returns whether the entries are in strictly ascending course ID order, which also means no
 * course repeats. IDs compare by UTF-16 code units, the `<` operator.
 *
 * @param courseIds - Entry course IDs, in the order shown.
 * @returns `true` when each ID is greater than the one before.
 */
function isStrictlyAscending(courseIds: readonly string[]): boolean {
  return courseIds.every(
    (courseId, index) => index === 0 || (courseIds[index - 1] ?? '') < courseId,
  );
}

/**
 * Returns whether every linked-course entry names a course with a shown section that no bundle
 * requested. Which linked courses need an entry is the engine's rule, not restated here.
 *
 * @param option - The bundles and the linked-course entries.
 * @returns `true` when each entry is about a shown, non-requested course.
 */
function linkedEntriesAreStructural(option: {
  readonly bundles: readonly {
    readonly courseId: string;
    readonly sections: readonly { readonly courseId: string }[];
  }[];
  readonly linkedCourseResults: readonly { readonly courseId: string }[];
}): boolean {
  const requested = new Set(option.bundles.map((bundle) => bundle.courseId));
  const shown = new Set(
    option.bundles.flatMap((bundle) => bundle.sections.map((section) => section.courseId)),
  );
  return option.linkedCourseResults.every(
    ({ courseId }) => shown.has(courseId) && !requested.has(courseId),
  );
}

/**
 * One validated schedule option. The academic checks (prerequisite, applicability,
 * allocation) are the same for every option, and the credit load is this option's own
 * (ADR-0010 §2). Each dimension is shown separately; passing one implies nothing else.
 */
export const ScheduleOptionSchema = z
  .object({
    /** Position in the ranking, 1 first (ADR-0010 §4). */
    rank: z.number().int().min(1).max(MAX_SCHEDULE_OPTIONS),
    /**
     * One bundle per requested course. This schema checks the bundles are distinct and match
     * `courseResults`; `ScheduleOptionsResponseSchema` checks they cover every requested course.
     */
    bundles: z.array(SectionBundleSchema).min(1).max(MAX_SCHEDULE_OPTION_COURSES).readonly(),
    /**
     * The SCHEDULE_FEASIBILITY check of the whole option: PASS, or UNKNOWN when missing data
     * such as a TBA meeting time or an undefined campus transition leaves it undecided. Never
     * FAIL: a candidate that fails a hard rule isn't an option.
     */
    scheduleFeasibility: checkOfKind(CheckKind.ScheduleFeasibility),
    /** Per-course academic checks, one per requested course. */
    courseResults: z
      .array(CourseCheckResultSchema)
      .min(1)
      .max(MAX_SCHEDULE_OPTION_COURSES)
      .readonly(),
    /**
     * One result per linked course the option adds beyond the requested ones, chosen by the
     * engine (ADR-0010 Amendment 4), in ascending course ID, never repeated, and `[]` when there
     * are none. Its checks count in the aggregate. With the engine's S4 output (UNKNOWN
     * `LINKED_COURSE_NOT_CHECKED`), an option with an entry is NEEDS_VERIFICATION.
     */
    linkedCourseResults: z.array(CourseCheckResultSchema).readonly(),
    setResults: SetCheckResultsSchema,
    /** Preferences this option misses, rendered from structured fields only. */
    unmetPreferences: z.array(UnmetPreferenceSchema).readonly(),
    /** Aggregate of every check of the option, by the fixed precedence. */
    aggregate: AggregateStateSchema,
  })
  // SAFETY: a candidate that breaks a hard rule is removed, never offered, and each hard rule
  // gives PASS, FAIL or UNKNOWN (ADR-0010 §3). So an option's schedule is PASS or UNKNOWN only:
  // a CONDITIONAL would be a state no schedule check produces, ranked as if it were UNKNOWN.
  .refine(
    (option) =>
      option.scheduleFeasibility.state === CheckState.Pass ||
      option.scheduleFeasibility.state === CheckState.Unknown,
    { message: 'scheduleFeasibility must be PASS or UNKNOWN', path: ['scheduleFeasibility'] },
  )
  // SAFETY: the credit load within the policy bounds and the student's hard credit range is a
  // hard rule too, so a candidate whose load FAILs is removed, never offered (ADR-0010 §3). It
  // belongs in `conflictSet`, which accepts CREDIT_LOAD FAILs for this reason.
  .refine((option) => option.setResults.creditLoad.state !== CheckState.Fail, {
    message: 'An option never has a FAIL creditLoad',
    path: ['setResults', 'creditLoad'],
  })
  // SAFETY: each hard rule gives PASS, FAIL or UNKNOWN (ADR-0010 §3), and the load of a chosen
  // candidate set depends on no future condition, so a CONDITIONAL load would let the option
  // rank as a PASS schedule over a load nobody decided.
  .refine((option) => option.setResults.creditLoad.state !== CheckState.Conditional, {
    message: 'An option never has a CONDITIONAL creditLoad',
    path: ['setResults', 'creditLoad'],
  })
  // SAFETY: an unknown hard rule leaves the option's schedule feasibility UNKNOWN, never PASS
  // (ADR-0010 §3), so an option whose credit load is undecided never ranks as a PASS schedule.
  .refine(
    (option) =>
      option.setResults.creditLoad.state !== CheckState.Unknown ||
      option.scheduleFeasibility.state === CheckState.Unknown,
    {
      message: 'An UNKNOWN creditLoad requires an UNKNOWN scheduleFeasibility',
      path: ['scheduleFeasibility'],
    },
  )
  // SAFETY: the bundle credits and the load total are one credit fact shown twice, so they must
  // agree. An unknown bundle credit (for example an unselected variable value) makes the load
  // UNKNOWN, never a PASS over a guessed total (planning/08 §Constraint formulation).
  .refine(creditsAgreeWithLoad, {
    message:
      'creditLoad must be UNKNOWN when a bundle credit is null, and its total must equal the bundle credits',
    path: ['setResults', 'creditLoad'],
  })
  // SAFETY: the solver picks exactly one bundle per requested course, and the academic checks
  // must be about the same courses as the sections shown.
  .refine(
    (option) => {
      const bundled = option.bundles.map((bundle) => bundle.courseId);
      const checked = new Set(option.courseResults.map((result) => result.courseId));
      return (
        isDistinct(bundled) &&
        checked.size === option.courseResults.length &&
        checked.size === bundled.length &&
        bundled.every((courseId) => checked.has(courseId))
      );
    },
    {
      message: 'bundles and courseResults must each name every requested course once',
      path: ['bundles'],
    },
  )
  // SAFETY: an entry must be about a linked course the option shows, never a requested one, or
  // its UNKNOWN checks would describe a course the student didn't see (ADR-0010 Amendment 4).
  .refine((option) => linkedEntriesAreStructural(option), {
    message: 'linkedCourseResults must name only shown courses that no bundle requests',
    path: ['linkedCourseResults'],
  })
  .refine((option) => isStrictlyAscending(option.linkedCourseResults.map((r) => r.courseId)), {
    message: 'linkedCourseResults must be in ascending course ID order, without repeats',
    path: ['linkedCourseResults'],
  })
  .refine(
    (option) =>
      isDistinct(
        option.bundles.flatMap((bundle) => bundle.sections.map((section) => section.sectionId)),
      ),
    { message: 'A section may appear in only one bundle', path: ['bundles'] },
  )
  // SAFETY: an unmet preference must point at a section the student can see in this option.
  .refine(
    (option) => {
      const shown = new Set<string>(
        option.bundles.flatMap((bundle) => bundle.sections.map((section) => section.sectionId)),
      );
      return option.unmetPreferences.every(
        (unmet) => unmet.sectionId === null || shown.has(unmet.sectionId),
      );
    },
    {
      message: 'An unmet preference must name a section of this option',
      path: ['unmetPreferences'],
    },
  )
  // SAFETY: the aggregate must follow from every check it summarizes, including schedule
  // feasibility, so an UNKNOWN is never shown as validated (planning/08 aggregate precedence).
  .refine(
    (option) =>
      option.aggregate ===
      deriveAggregateState(listOptionChecks(option).map((check) => check.state)),
    {
      message: 'aggregate must follow the FAIL, UNKNOWN, CONDITIONAL, PASS precedence',
      path: ['aggregate'],
    },
  )
  .readonly();

/** One validated schedule option. */
export type ScheduleOption = z.infer<typeof ScheduleOptionSchema>;
