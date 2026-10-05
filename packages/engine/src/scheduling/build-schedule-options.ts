/**
 * @file Builds the solver's options and conflict set, with real checks, from the search's choices.
 * @module @caa/engine/scheduling/build-schedule-options
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-10
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  CheckKind,
  type CheckResult,
  CheckState,
  createCheckResult,
  createUnmetPreference,
  ScheduleConstraintKind,
  type UnmetPreference,
} from '@caa/domain';

import { type CourseSelection, selectedCreditsOf } from '../verification/candidate-set';
import type { PairTable } from './bundle-pair-table';
import {
  creditLoadCheckOf,
  type CreditModel,
  knownSelectionsOf,
  missesPreferredRange,
} from './candidate-credits';
import { toScheduleFeasibilityCheck } from './schedule-feasibility-check';
import {
  MAX_CONFLICT_ITEMS,
  type SolvedBundle,
  type SolvedScheduleOption,
  type SolverConflictSet,
  type SolveScheduleInput,
} from './schedule-solution';
import type { ConflictEntry, PreferenceSlot, ScreenedBundle } from './screen-bundles';
import type { FoundCandidate, SearchBundle, SearchResult } from './search-schedules';
import { compareText, tieBreakKeyOf } from './tie-break-key';

/** One bundle as the solver holds it: its course, screening and search data. */
export interface SolverBundle {
  /** Position of its requested course, by course ID. */
  readonly requestIndex: number;
  readonly screened: ScreenedBundle;
  readonly search: SearchBundle;
}

/** What building options and conflicts reads. */
export interface OptionContext {
  readonly input: SolveScheduleInput;
  /** Every bundle; each one's position is its `search.index`. */
  readonly bundles: readonly SolverBundle[];
  readonly table: PairTable;
  readonly credits: CreditModel;
  readonly slots: readonly PreferenceSlot[];
}

/**
 * Builds the options for the best candidates, rebuilding every check for real.
 *
 * @param top - The best candidates, best first.
 * @param context - The bundles, pair verdicts, credit model and request.
 * @returns The options, ranked from 1.
 */
export function buildOptions(
  top: readonly FoundCandidate[],
  context: OptionContext,
): SolvedScheduleOption[] {
  return top.map((candidate, position) => {
    const chosen = chosenBundles(candidate.chosen, context);
    const selections = selectionsOf(chosen, context);
    const creditLoad = creditLoadCheckOf(selections, context.input.policy, context.credits);
    const bundles = chosen.map((entry) => solvedBundle(entry, selections));
    const credits = bundles.map((entry) => entry.creditsCountedHundredths);
    const total = sumOrNull(credits);
    return {
      rank: position + 1,
      bundles,
      scheduleFeasibility: feasibilityOf(chosen, creditLoad, context.table),
      creditLoad,
      unmetPreferences: unmetOf(chosen, total, context),
    };
  });
}

/**
 * Builds the real FAILs of the candidates the search removed for their credit load.
 *
 * @param result - The search result.
 * @param context - The bundles and request.
 * @returns One entry per kept credit conflict, and how many there were in all.
 */
export function creditConflictsOf(
  result: SearchResult,
  context: OptionContext,
): { readonly entries: readonly ConflictEntry[]; readonly count: number } {
  return {
    entries: result.creditConflicts.map((conflict) =>
      creditConflictOf(chosenBundles(conflict.chosen, context), context),
    ),
    count: result.creditConflictCount,
  };
}

/**
 * Builds the conflict set: every distinct FAIL found, sorted by reason code then by the
 * tie-break of its sections, the first 20 shown and the rest counted (ADR-0010 §5).
 *
 * @param entries - FAILs found before and during the search, possibly repeated.
 * @param credit - The credit-load FAILs kept, and how many there were in all.
 * @returns The conflict set, never claimed to be minimal.
 */
export function buildConflictSet(
  entries: readonly ConflictEntry[],
  credit: { readonly entries: readonly ConflictEntry[]; readonly count: number },
): SolverConflictSet {
  const distinct = [
    ...new Map(entries.map((entry) => [`${entry.reasonCode}\n${entry.key}`, entry])).values(),
  ];
  const total = distinct.length + credit.count;
  const items = [...distinct, ...credit.entries]
    .sort(
      (first, second) =>
        compareText(first.reasonCode, second.reasonCode) || compareText(first.key, second.key),
    )
    .slice(0, MAX_CONFLICT_ITEMS)
    .map((entry) => entry.check);
  // SAFETY: minimality is never checked, so the set never claims it (planning/08 §Constraint
  // formulation; ADR-0010 §5).
  return { items, isMinimal: false, omittedCount: total - items.length };
}

/**
 * Picks a candidate's bundles, by course ID.
 *
 * @param indexes - The bundles' positions.
 * @param context - Every bundle.
 * @returns The chosen bundles, by course ID.
 */
function chosenBundles(indexes: readonly number[], context: OptionContext): SolverBundle[] {
  const wanted = new Set(indexes);
  return context.bundles.filter((entry) => wanted.has(entry.search.index));
}

/**
 * Builds a plan's credit selections.
 *
 * @param chosen - The chosen bundles.
 * @param context - The request.
 * @returns The selections.
 */
function selectionsOf(
  chosen: readonly SolverBundle[],
  context: OptionContext,
): readonly CourseSelection[] {
  return knownSelectionsOf(
    chosen.map((entry) => entry.screened.bundle),
    context.input.selectedCredits,
  );
}

/**
 * Builds the real FAIL for a candidate removed by its credit load.
 *
 * @param chosen - The candidate's bundles.
 * @param context - The request and credit model.
 * @returns The conflict entry.
 */
function creditConflictOf(chosen: readonly SolverBundle[], context: OptionContext): ConflictEntry {
  const check = creditLoadCheckOf(
    selectionsOf(chosen, context),
    context.input.policy,
    context.credits,
  );
  const sectionIds = chosen.flatMap((entry) =>
    entry.screened.bundle.sections.map((section) => section.id),
  );
  return { reasonCode: String(check.reasonCode), key: tieBreakKeyOf(sectionIds), check };
}

/**
 * Pairs a bundle with the credits it adds to its plan.
 *
 * @param entry - The bundle.
 * @param selections - The plan's selections.
 * @returns The bundle and its counted credits, or `null` when a value isn't chosen.
 */
function solvedBundle(entry: SolverBundle, selections: readonly CourseSelection[]): SolvedBundle {
  const { bundle } = entry.screened;
  const own = new Set<string>(bundle.courses.map((course) => course.id));
  const values = selections
    .filter((selection) => selection.countsCredits && own.has(selection.course.id))
    .map((selection) => selectedCreditsOf(selection));
  return {
    bundle,
    creditsCountedHundredths: sumOrNull(values),
  };
}

/**
 * Adds up credit values.
 *
 * @param values - Credits in hundredths, `null` where unknown.
 * @returns The sum, or `null` when any value is unknown.
 */
function sumOrNull(values: readonly (number | null)[]): number | null {
  let total = 0;
  for (const value of values) {
    if (value === null) return null;
    total += value;
  }
  return total;
}

/**
 * Builds an option's schedule-feasibility check from every UNKNOWN it holds.
 *
 * @param chosen - The option's bundles.
 * @param creditLoad - Its credit-load check.
 * @param table - The pair verdicts.
 * @returns PASS, or UNKNOWN naming the missing data or the undecided load.
 */
function feasibilityOf(
  chosen: readonly SolverBundle[],
  creditLoad: CheckResult,
  table: PairTable,
): CheckResult {
  const issues = [
    ...chosen.flatMap((entry) => entry.screened.unknownIssues),
    ...chosen.flatMap((first, position) =>
      chosen
        .slice(position + 1)
        .flatMap(
          (second) => table.verdictOf(first.search.index, second.search.index).unknownIssues,
        ),
    ),
  ];
  // SAFETY: an undecided credit load is a hard rule left UNKNOWN, so the schedule is UNKNOWN,
  // never PASS (ADR-0010 §3).
  if (issues.length === 0 && creditLoad.state === CheckState.Unknown) {
    return createCheckResult({
      kind: CheckKind.ScheduleFeasibility,
      state: CheckState.Unknown,
      reasonCode: creditLoad.reasonCode,
    });
  }
  return toScheduleFeasibilityCheck(issues);
}

/**
 * Lists where an option misses preferences, by priority rank.
 *
 * @param chosen - The option's bundles.
 * @param total - Its counted credits, or `null` when unknown.
 * @param context - The preference slots and credit model.
 * @returns The unmet preferences.
 */
function unmetOf(
  chosen: readonly SolverBundle[],
  total: number | null,
  context: OptionContext,
): UnmetPreference[] {
  const credit = context.slots
    .filter((slot) => slot.kind === ScheduleConstraintKind.CreditRange)
    .filter(() => missesPreferredRange(context.credits, total))
    .map((slot) =>
      createUnmetPreference({
        constraintIndex: slot.constraintIndex,
        priorityRank: slot.priorityRank,
        kind: slot.kind,
        sectionId: null,
        meetingIndex: null,
        isDataUnknown: total === null,
      }),
    );
  return [...chosen.flatMap((entry) => entry.screened.unmet), ...credit].sort(
    (first, second) => first.priorityRank - second.priorityRank,
  );
}
