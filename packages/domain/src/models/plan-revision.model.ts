/**
 * @file Plan revision data object: one immutable saved or revalidated state of a plan.
 * @module @caa/domain/models/plan-revision
 * @requirement FR-11
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { PlanRevisionCauseSchema } from '../enums/plan-revision-cause.enum';
import { ScheduleOutcome, ScheduleOutcomeSchema } from '../enums/schedule-outcome.enum';
import { AuditSnapshotIdSchema } from './audit-snapshot.model';
import { CourseIdSchema } from './course.model';
import { CreditSelectionSchema } from './credit-selection.model';
import { PlanIdSchema } from './plan.model';
import { ScheduleConstraintSetSchema } from './schedule-constraint.model';
import { SectionIdSchema } from './section.model';
import { SectionSnapshotIdSchema } from './section-snapshot.model';
import { StudentSnapshotIdSchema } from './student-snapshot.model';
import { TermIdSchema } from './term.model';
import { UserIdSchema } from './user-identity.model';

/**
 * Most courses a plan revision, and so a schedule-options request, may name (ADR-0010 §2).
 * ADR-0013 §2 stores the replayed request, so the two caps must be one value.
 */
export const MAX_PLAN_COURSES = 8;

/** Most solver work units a search may use (ADR-0010 §1). The stored cap can't exceed it. */
export const MAX_PLAN_SOLVER_WORK_CAP = 3_000_000;

/** Most sections a chosen option may hold: a bundle of linked sections for each course. */
export const MAX_PLAN_SECTIONS = 64;

/** Branded ID so a plan revision ID can never be passed where another ID is expected. */
export const PlanRevisionIdSchema = z.uuid().brand<'PlanRevisionId'>();

/** Unique identifier of a {@link PlanRevision}. */
export type PlanRevisionId = z.infer<typeof PlanRevisionIdSchema>;

/**
 * Returns whether the values are in strictly ascending order, which means sorted and distinct.
 *
 * @param values - Values to check.
 * @returns `true` when each value is greater than the one before it.
 */
function isStrictlyAscending(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || (values[index - 1] ?? '') < value);
}

/**
 * Returns whether no value appears twice.
 *
 * @param values - Values to check.
 * @returns `true` when every value appears once.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Schema for a plan revision. The stored schedule-options result is opaque here and is kept
 * by `@caa/db` and parsed by the API on read (ADR-0013 §2).
 */
export const PlanRevisionSchema = z
  .strictObject({
    id: PlanRevisionIdSchema,
    planId: PlanIdSchema,
    /** Position in the plan's history, 1 first. */
    revision: z.number().int().min(1),
    cause: PlanRevisionCauseSchema,
    /** User who saved or asked for the revalidation. */
    createdBy: UserIdSchema,
    /** ISO 8601 with offset. */
    createdAt: z.iso.datetime({ offset: true }),
    termId: TermIdSchema,
    /** 1 to 8 distinct courses, all required. */
    courseIds: z.array(CourseIdSchema).min(1).max(MAX_PLAN_COURSES).readonly(),
    creditSelections: z.array(CreditSelectionSchema).max(MAX_PLAN_COURSES).readonly(),
    constraints: ScheduleConstraintSetSchema,
    studentSnapshotId: StudentSnapshotIdSchema,
    /** The point in time the pinned student record describes. ISO 8601 with offset. */
    studentRecordEffectiveAt: z.iso.datetime({ offset: true }),
    /** The point in time of the student record the pinned audit ran against. ISO 8601 with offset. */
    auditRecordEffectiveAt: z.iso.datetime({ offset: true }),
    auditSnapshotId: AuditSnapshotIdSchema,
    /** Audit system of the pinned audit. */
    auditSource: z.string().min(1),
    /** The audit system's run or revision ID. */
    auditVersion: z.string().min(1),
    rulesetVersion: z.string().min(1),
    sectionSnapshotId: SectionSnapshotIdSchema,
    /** Version of the tenant's campus transition table, or `null` when the tenant has none. */
    campusTransitionVersion: z.string().min(1).nullable(),
    /** The solver work cap the search ran under. */
    solverWorkCap: z.number().int().min(1).max(MAX_PLAN_SOLVER_WORK_CAP),
    /** `sha256:` and the lowercase hex SHA-256 of the normalized request's canonical JSON. */
    constraintHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    outcome: ScheduleOutcomeSchema,
    /** The chosen sections, sorted and distinct; `null` unless the outcome is `OPTIONS_FOUND`. */
    selectedSectionIds: z
      .array(SectionIdSchema)
      .min(1)
      .max(MAX_PLAN_SECTIONS)
      .readonly()
      .nullable(),
  })
  .refine((revision) => isDistinct(revision.courseIds), {
    message: 'courseIds must not repeat a course',
    path: ['courseIds'],
  })
  // SAFETY: two values for one course would let the server pick which credits count when
  // revalidation replays the stored inputs (ADR-0013 §4; planning/08 §Candidate formation and
  // allocation: do not assume credit values).
  .refine(
    (revision) => isDistinct(revision.creditSelections.map((selection) => selection.courseId)),
    {
      message: 'creditSelections must not repeat a course',
      path: ['creditSelections'],
    },
  )
  // SAFETY: a credit value for a course outside the plan would change a replay's credit load
  // (ADR-0013 §4).
  .refine(
    (revision) =>
      revision.creditSelections.every((selection) =>
        revision.courseIds.includes(selection.courseId),
      ),
    { message: 'Each creditSelections course must be in courseIds', path: ['creditSelections'] },
  )
  // SAFETY: a selection on a result with no options, or none on a result with options,
  // would present a schedule the engine never produced (or hide the one it did)
  // (ADR-0013 §2: the chosen section set, or `null` when the outcome has no options).
  .refine(
    (revision) =>
      (revision.outcome === ScheduleOutcome.OptionsFound) ===
      (revision.selectedSectionIds !== null),
    {
      message: 'selectedSectionIds is set exactly when the outcome is OPTIONS_FOUND',
      path: ['selectedSectionIds'],
    },
  )
  // SAFETY: a fixed order makes the same selection compare equal, so the replay check and the
  // revalidation carry-over of an identical section set can't be fooled by list order
  // (ADR-0013 §2 and §4).
  .refine(
    (revision) =>
      revision.selectedSectionIds === null || isStrictlyAscending(revision.selectedSectionIds),
    { message: 'selectedSectionIds must be sorted and distinct', path: ['selectedSectionIds'] },
  )
  .readonly();

/** A validated, immutable plan revision. */
export type PlanRevision = z.infer<typeof PlanRevisionSchema>;

/** Raw input accepted by {@link createPlanRevision}. */
export type PlanRevisionInput = z.input<typeof PlanRevisionSchema>;

/**
 * Creates a validated, immutable plan revision.
 *
 * @param input - Raw revision fields.
 * @returns The parsed plan revision.
 * @throws {z.ZodError} When a field is invalid, a course or credit selection repeats or is out
 *   of plan, or the section selection doesn't match the outcome or isn't sorted and distinct.
 */
export function createPlanRevision(input: PlanRevisionInput): PlanRevision {
  return PlanRevisionSchema.parse(input);
}
