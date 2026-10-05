/**
 * @file The expected half of a scheduling golden case: the outcome, the options with their
 *   section sets and checks, the conflict set, and the unresolved items, in the response shape
 *   ADR-0010 §5 and the #213 contract give, with the schedule reason codes of #266.
 * @module @caa/test-kit/golden/golden-schedule-expectation-schema
 * @requirement FR-07
 * @requirement FR-18
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { z } from 'zod';

import {
  CheckKind,
  CheckState,
  ReasonCode,
  ScheduleOutcome,
  ScheduleOutcomeSchema,
  SectionIdSchema,
} from '@caa/domain';

import { ExpectedCheckSchema } from './golden-expectation.schema';
import {
  ExpectedScheduleIssueSchema,
  isAscendingIds,
  issuesExplainCheck,
} from './golden-schedule-issue.schema';

/** Most options a response carries (ADR-0010 §4). */
const MAX_OPTIONS = 3;

/** Most items a conflict set lists before it counts the rest (ADR-0010 §5). */
const MAX_CONFLICT_ITEMS = 20;

/** A check the engine must return with the schedule issues that explain it, decisive first. */
export const ExpectedScheduleCheckSchema = z
  .strictObject({
    check: ExpectedCheckSchema,
    issues: z.array(ExpectedScheduleIssueSchema).readonly(),
  })
  .refine(({ check, issues }) => issuesExplainCheck(check, issues), {
    message: 'A non-PASS schedule check has issues that mean its state and include its reason',
    path: ['issues'],
  })
  .readonly();

/** One expected option: its sections as a set, its schedule check, and what it leaves unmet. */
export const ExpectedScheduleOptionSchema = z
  .strictObject({
    /** Every section in the option, ascending: the same set, whatever bundle order. */
    sectionIds: z.array(SectionIdSchema).min(1).readonly(),
    scheduleFeasibility: ExpectedScheduleCheckSchema,
    /** The option's credit-load check, when the case is about it. */
    creditLoad: ExpectedCheckSchema.optional(),
    /** Constraint indexes of the preferences the option misses, ascending, when compared. */
    unmetPreferenceIndexes: z.array(z.number().int().nonnegative()).readonly().optional(),
  })
  .refine((option) => isAscendingIds(option.sectionIds), {
    message: 'sectionIds must be distinct and ascending',
    path: ['sectionIds'],
  })
  // SAFETY: a candidate that breaks a hard rule is removed, never offered (ADR-0010 §3).
  .refine(
    ({ scheduleFeasibility: { check } }) =>
      check.kind === CheckKind.ScheduleFeasibility &&
      (check.state === CheckState.Pass || check.state === CheckState.Unknown),
    { message: 'An option is a PASS or UNKNOWN schedule check', path: ['scheduleFeasibility'] },
  )
  .refine((option) => (option.creditLoad?.kind ?? CheckKind.CreditLoad) === CheckKind.CreditLoad, {
    message: 'creditLoad must be a CREDIT_LOAD check',
    path: ['creditLoad'],
  })
  // SAFETY: the credit load is a hard rule, so a FAIL load removes the candidate, and no chosen
  // set's load is CONDITIONAL (ADR-0010 §3; the contract's ScheduleOptionSchema).
  .refine(
    ({ creditLoad }) =>
      creditLoad?.state !== CheckState.Fail && creditLoad?.state !== CheckState.Conditional,
    { message: 'An option never has a FAIL or CONDITIONAL creditLoad', path: ['creditLoad'] },
  )
  // SAFETY: an undecided hard rule leaves the schedule UNKNOWN, never PASS (ADR-0010 §3).
  .refine(
    ({ creditLoad, scheduleFeasibility: { check } }) =>
      creditLoad?.state !== CheckState.Unknown || check.state === CheckState.Unknown,
    {
      message: 'An UNKNOWN creditLoad requires an UNKNOWN scheduleFeasibility',
      path: ['scheduleFeasibility'],
    },
  )
  .readonly();

/** One expected option. */
export type ExpectedScheduleOption = z.infer<typeof ExpectedScheduleOptionSchema>;

/** A conflict-set item: a verified FAIL of the schedule or the credit load (ADR-0010 §5). */
const ConflictItemSchema = ExpectedScheduleCheckSchema.refine(
  ({ check }) =>
    check.state === CheckState.Fail &&
    (check.kind === CheckKind.ScheduleFeasibility || check.kind === CheckKind.CreditLoad),
  { message: 'A conflict is a FAIL SCHEDULE_FEASIBILITY or CREDIT_LOAD check' },
);

/** An unresolved item: a requested course with no bundle because data is missing. */
const UnresolvedItemSchema = ExpectedScheduleCheckSchema.refine(
  ({ check }) =>
    check.kind === CheckKind.ScheduleFeasibility &&
    check.state === CheckState.Unknown &&
    (check.reasonCode === ReasonCode.SectionDataMissing ||
      check.reasonCode === ReasonCode.LinkedSectionUnavailable),
  { message: 'An unresolved item is an UNKNOWN check for a missing section or link' },
);

/** What each outcome carries (ADR-0010 §5). `null` for `searchComplete` means either value. */
const OUTCOME_SHAPE: Readonly<
  Record<
    ScheduleOutcome,
    {
      readonly searchComplete: boolean | null;
      readonly options: boolean;
      readonly conflicts: boolean;
      readonly unresolved: boolean;
    }
  >
> = {
  [ScheduleOutcome.OptionsFound]: {
    searchComplete: null,
    options: true,
    conflicts: false,
    unresolved: false,
  },
  [ScheduleOutcome.NoFeasiblePlan]: {
    searchComplete: true,
    options: false,
    conflicts: true,
    unresolved: false,
  },
  [ScheduleOutcome.SearchTimeout]: {
    searchComplete: false,
    options: false,
    conflicts: false,
    unresolved: false,
  },
  [ScheduleOutcome.NeedsVerification]: {
    searchComplete: false,
    options: false,
    conflicts: false,
    unresolved: true,
  },
};

/** The full expected result of one scheduling case. */
export const ExpectedScheduleSchema = z
  .strictObject({
    outcome: ScheduleOutcomeSchema,
    searchComplete: z.boolean(),
    /** Best first. */
    options: z.array(ExpectedScheduleOptionSchema).max(MAX_OPTIONS).readonly(),
    conflictSet: z
      .strictObject({
        items: z.array(ConflictItemSchema).min(1).max(MAX_CONFLICT_ITEMS).readonly(),
        omittedCount: z.number().int().nonnegative(),
      })
      // SAFETY: a repeated conflict would be shown twice and use up the cap, hiding a distinct
      // one (ADR-0010 §5: deduplicated by reason code and sections; ConflictSetSchema).
      // NOTE: parsed items keep the schema's key order, so equal items give equal JSON.
      .refine(
        ({ items }) => new Set(items.map((item) => JSON.stringify(item))).size === items.length,
        { message: 'conflictSet items must be distinct', path: ['items'] },
      )
      .readonly()
      .nullable(),
    unresolved: z.array(UnresolvedItemSchema).readonly(),
  })
  // SAFETY: each outcome carries exactly its evidence, so a capped search is never expected as
  // infeasible and an infeasible one always shows its conflicts (ADR-0010 §5; AC12).
  .refine(
    (expected) => {
      const shape = OUTCOME_SHAPE[expected.outcome];
      return (
        (shape.searchComplete === null || shape.searchComplete === expected.searchComplete) &&
        shape.options === expected.options.length > 0 &&
        shape.conflicts === (expected.conflictSet !== null) &&
        shape.unresolved === expected.unresolved.length > 0
      );
    },
    { message: 'searchComplete, options, conflictSet and unresolved must match the outcome' },
  )
  // SAFETY: an UNKNOWN schedule never ranks above a PASS one, and options are distinct
  // (ADR-0010 §4).
  .refine(
    ({ options }) => {
      const passCount = options.filter(
        (option) => option.scheduleFeasibility.check.state === CheckState.Pass,
      ).length;
      const sets = new Set(options.map((option) => option.sectionIds.join(',')));
      return (
        sets.size === options.length &&
        options.every(
          (option, index) =>
            (option.scheduleFeasibility.check.state === CheckState.Pass) === index < passCount,
        )
      );
    },
    { message: 'Options must be distinct, with PASS schedules first', path: ['options'] },
  )
  .refine(
    ({ conflictSet }) =>
      conflictSet === null ||
      conflictSet.omittedCount === 0 ||
      conflictSet.items.length === MAX_CONFLICT_ITEMS,
    { message: 'omittedCount must be 0 unless items is full', path: ['conflictSet'] },
  )
  .readonly();

/** The full expected result of one scheduling case. */
export type ExpectedSchedule = z.infer<typeof ExpectedScheduleSchema>;

/** Raw input accepted for {@link ExpectedScheduleSchema}. */
export type ExpectedScheduleInput = z.input<typeof ExpectedScheduleSchema>;
