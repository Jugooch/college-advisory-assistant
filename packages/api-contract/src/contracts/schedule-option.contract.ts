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
  readonly setResults: {
    readonly allocation: readonly CheckResult[];
    readonly creditLoad: CheckResult;
  };
}

/**
 * Lists every check of an option. A `null` prerequisite is not a check and isn't listed.
 *
 * @param option - The option's checks.
 * @returns Every check result: schedule feasibility, then per-course, then set checks.
 */
function listOptionChecks(option: ScheduleOptionShape): readonly CheckResult[] {
  return [
    option.scheduleFeasibility,
    ...option.courseResults.flatMap(({ prerequisite, applicability }) =>
      prerequisite === null ? [applicability] : [prerequisite, applicability],
    ),
    ...option.setResults.allocation,
    option.setResults.creditLoad,
  ];
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
    /** One bundle per requested course. */
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
    setResults: SetCheckResultsSchema,
    /** Preferences this option misses, rendered from structured fields only. */
    unmetPreferences: z.array(UnmetPreferenceSchema).readonly(),
    /** Aggregate of every check of the option, by the fixed precedence. */
    aggregate: AggregateStateSchema,
  })
  // SAFETY: a candidate that breaks a hard rule is removed, never offered (ADR-0010 §3).
  .refine((option) => option.scheduleFeasibility.state !== CheckState.Fail, {
    message: 'An option never has a FAIL scheduleFeasibility',
    path: ['scheduleFeasibility'],
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
