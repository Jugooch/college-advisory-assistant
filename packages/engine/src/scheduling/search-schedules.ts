/**
 * @file Bounded depth-first search for the best three schedules, counting work against a cap.
 * @module @caa/engine/scheduling/search-schedules
 * @requirement FR-07
 * @requirement FR-08
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { CheckState } from '@caa/domain';

import type { PairTable } from './bundle-pair-table';
import { type CreditModel, creditVerdictOf, missesPreferredRange } from './candidate-credits';
import {
  compareNumberLists,
  comparePreferenceParts,
  compareRankKeys,
  type RankKey,
} from './schedule-rank';
import { MAX_CONFLICT_ITEMS, MAX_SOLVER_OPTIONS } from './schedule-solution';
import type { ConflictEntry } from './screen-bundles';
import { compareText } from './tie-break-key';

/** One course of a bundle, as the credit total needs it. */
export interface SearchCourseCredits {
  /** The course's position among every course of the search. */
  readonly index: number;
  /** Its credits in hundredths, or `null` for an unchosen variable value. */
  readonly credits: number | null;
  /** Position of the course that includes its credits, or -1 when none can. */
  readonly includer: number;
}

/** What the search needs to know about one bundle. */
export interface SearchBundle {
  /** The bundle's position in the pair table. */
  readonly index: number;
  readonly isUnknown: boolean;
  readonly misses: readonly number[];
  readonly ordinals: readonly number[];
  readonly courses: readonly SearchCourseCredits[];
  /**
   * The bundle's ordered course list, as a number shared by every bundle with the same list.
   * A candidate's credit-load check depends only on its bundles' course lists.
   */
  readonly courseListId: number;
}

/** The search's inputs, every bundle named by its position in `bundles`. */
export interface SearchSpace {
  /** Each requested course's bundles, courses and bundles in search order. */
  readonly courses: readonly (readonly SearchBundle[])[];
  /** How many distinct courses all bundles hold. */
  readonly courseCount: number;
  /** How many preferences there are. */
  readonly slotCount: number;
  readonly table: PairTable;
  readonly credits: CreditModel;
  /** The preference slot of the preferred credit range, or `null` when there is none. */
  readonly creditSlot: number | null;
}

/** A candidate that keeps every hard rule. */
export interface FoundCandidate extends RankKey {
  /** Its bundles' pair-table positions, one per course, in search order. */
  readonly chosen: readonly number[];
}

/** A candidate removed because its credit load FAILs. */
export interface CreditConflict {
  /** The FAIL's reason code, as text for ordering. */
  readonly reasonCode: string;
  readonly ordinals: readonly number[];
  readonly chosen: readonly number[];
}

/** What the search found. */
export interface SearchResult {
  /** The best candidates, best first, at most three. */
  readonly top: readonly FoundCandidate[];
  /** Whether the cap stopped the search before it finished. */
  readonly capHit: boolean;
  /** Attempts made; never more than the cap. */
  readonly workUsed: number;
  /** Distinct FAILs between two bundles that the search met, in the order met. */
  readonly pairFails: readonly ConflictEntry[];
  /**
   * The first distinct credit-load FAILs in conflict order, at most {@link MAX_CONFLICT_ITEMS},
   * each the first in conflict order of the candidates that give the same FAIL.
   */
  readonly creditConflicts: readonly CreditConflict[];
  /** How many distinct credit-load FAILs the search met in all. */
  readonly creditConflictCount: number;
}

/** The search's mutable state, private to one call. */
interface Walk {
  readonly space: SearchSpace;
  readonly cap: number;
  used: number;
  capHit: boolean;
  readonly chosen: SearchBundle[];
  /** UNKNOWN bundles and UNKNOWN bundle pairs on the current path. */
  unknownCount: number;
  readonly present: Uint8Array;
  /** The current path's section ordinals, kept sorted, so a leaf's tie-break needs no sort. */
  readonly ordinals: number[];
  readonly top: FoundCandidate[];
  readonly pairFails: Map<string, ConflictEntry>;
  /** The first candidate in conflict order for each distinct credit-load FAIL, by its key. */
  readonly creditConflicts: Map<string, CreditConflict>;
}

/**
 * Searches every combination of one bundle per course, in search order, for the best three.
 *
 * One unit of work is one attempt to add one bundle to a partial schedule, counted before its
 * hard rules are checked (ADR-0010 §1). The search stops when it would need an attempt beyond
 * the cap, so it never uses more than the cap, and a search that needs exactly the cap is
 * complete. Elapsed time is never read.
 *
 * @param space - The courses, bundles, pair verdicts and credit model.
 * @param workCap - The most attempts allowed.
 * @returns The best candidates, whether the cap was hit, the work used, and the FAILs met.
 */
export function searchSchedules(space: SearchSpace, workCap: number): SearchResult {
  const walk: Walk = {
    space,
    cap: workCap,
    used: 0,
    capHit: false,
    chosen: [],
    unknownCount: 0,
    ordinals: [],
    present: new Uint8Array(space.courseCount),
    top: [],
    pairFails: new Map(),
    creditConflicts: new Map(),
  };
  visit(walk, 0);
  return {
    top: walk.top,
    capHit: walk.capHit,
    workUsed: walk.used,
    pairFails: [...walk.pairFails.values()],
    creditConflicts: [...walk.creditConflicts.values()]
      .sort(compareCreditConflicts)
      .slice(0, MAX_CONFLICT_ITEMS),
    creditConflictCount: walk.creditConflicts.size,
  };
}

/**
 * Tries each bundle of the course at one depth, then goes deeper.
 *
 * @param walk - The search state.
 * @param depth - The course position in search order; past the last, the candidate is judged.
 * @returns `false` when the cap stopped the search.
 */
function visit(walk: Walk, depth: number): boolean {
  const course = walk.space.courses[depth];
  if (course === undefined) {
    return judgeLeaf(walk);
  }
  for (const bundle of course) {
    // SAFETY: the budget is counted work, never elapsed time, so identical inputs and cap stop
    // at the same point on any machine (NFR-01; ADR-0010 §1).
    if (walk.used === walk.cap) {
      walk.capHit = true;
      return false;
    }
    walk.used += 1;
    const unknownPairs = admit(walk, bundle);
    if (unknownPairs < 0) continue;
    enter(walk, bundle, unknownPairs);
    const isComplete = visit(walk, depth + 1);
    leave(walk, bundle, unknownPairs);
    if (!isComplete) return false;
  }
  return true;
}

/**
 * Checks a bundle against the bundles already chosen.
 *
 * @param walk - The search state.
 * @param bundle - The bundle to add.
 * @returns -1 when it conflicts with one, else how many chosen bundles it is UNKNOWN with.
 */
function admit(walk: Walk, bundle: SearchBundle): number {
  let unknownPairs = 0;
  for (const other of walk.chosen) {
    const verdict = walk.space.table.verdictOf(other.index, bundle.index);
    // SAFETY: a proven conflict between two chosen sections removes the candidate; hard rules
    // are never relaxed (ADR-0010 §3).
    if (verdict.fail !== null) {
      walk.pairFails.set(`${verdict.fail.reasonCode}\n${verdict.fail.key}`, verdict.fail);
      return -1;
    }
    if (verdict.unknownIssues.length > 0) unknownPairs += 1;
  }
  return unknownPairs;
}

/**
 * Adds a bundle to the partial schedule.
 *
 * @param walk - The search state.
 * @param bundle - The bundle.
 * @param unknownPairs - How many chosen bundles it is UNKNOWN with.
 */
function enter(walk: Walk, bundle: SearchBundle, unknownPairs: number): void {
  walk.chosen.push(bundle);
  walk.unknownCount += unknownPairs + Number(bundle.isUnknown);
  for (const ordinal of bundle.ordinals) {
    const position = walk.ordinals.findIndex((other) => other > ordinal);
    walk.ordinals.splice(position === -1 ? walk.ordinals.length : position, 0, ordinal);
  }
  for (const course of bundle.courses) walk.present[course.index] = 1;
}

/**
 * Removes the last bundle from the partial schedule.
 *
 * @param walk - The search state.
 * @param bundle - The bundle.
 * @param unknownPairs - How many chosen bundles it was UNKNOWN with.
 */
function leave(walk: Walk, bundle: SearchBundle, unknownPairs: number): void {
  walk.chosen.pop();
  walk.unknownCount -= unknownPairs + Number(bundle.isUnknown);
  for (const ordinal of bundle.ordinals) {
    walk.ordinals.splice(walk.ordinals.indexOf(ordinal), 1);
  }
  for (const course of bundle.courses) walk.present[course.index] = 0;
}

/**
 * Judges a complete candidate's credit load and keeps it if it ranks in the top three.
 *
 * @param walk - The search state, with one bundle chosen per course.
 * @returns Always `true`: a leaf never stops the search.
 */
function judgeLeaf(walk: Walk): boolean {
  const { space, chosen: bundles } = walk;
  const total = totalOf(walk, bundles);
  const verdict = creditVerdictOf(space.credits, total);
  // SAFETY: a credit load outside the policy bounds or the student's hard range removes the
  // candidate, never relaxed, and its FAIL is recorded as evidence (ADR-0010 §3 and §5).
  if (verdict.state === CheckState.Fail) {
    recordCreditConflict(walk, String(verdict.reasonCode), bundles);
    return true;
  }
  // SAFETY: any unknown bundle, pair or credit load leaves the candidate UNKNOWN, never PASS
  // (ADR-0010 §3).
  const isUnknown = walk.unknownCount > 0 || verdict.state === CheckState.Unknown;
  keepIfTop(walk, { isUnknown, misses: missesOf(space, bundles, total) }, bundles);
  return true;
}

/** The misses of a request with no preferences. */
const NO_MISSES: readonly number[] = [];

/**
 * Combines the preferences a candidate's bundles miss, with its credit-range preference.
 *
 * @param space - The search space, for the slots and credit model.
 * @param bundles - The chosen bundles.
 * @param total - The candidate's counted credits, or `null` when unknown.
 * @returns 1 for each missed preference slot, 0 otherwise.
 */
function missesOf(
  space: SearchSpace,
  bundles: readonly SearchBundle[],
  total: number | null,
): readonly number[] {
  if (space.slotCount === 0) return NO_MISSES;
  const misses = new Array<number>(space.slotCount).fill(0);
  for (const bundle of bundles) {
    bundle.misses.forEach((miss, slot) => {
      if (miss === 1) misses[slot] = 1;
    });
  }
  if (space.creditSlot !== null && missesPreferredRange(space.credits, total)) {
    misses[space.creditSlot] = 1;
  }
  return misses;
}

/**
 * Totals a candidate's counted credits, counting a course included in a chosen course once.
 *
 * @param walk - The search state, whose `present` marks the chosen courses.
 * @param bundles - The chosen bundles.
 * @returns The total in hundredths, or `null` when a counted variable value isn't chosen.
 */
function totalOf(walk: Walk, bundles: readonly SearchBundle[]): number | null {
  let total = 0;
  for (const bundle of bundles) {
    for (const course of bundle.courses) {
      // SAFETY: credits included in a chosen course are counted in that course's total only
      // (planning/08 §Constraint formulation).
      if (course.includer >= 0 && walk.present[course.includer] === 1) continue;
      if (course.credits === null) return null;
      total += course.credits;
    }
  }
  return total;
}

/**
 * Keeps a candidate when it ranks among the best three, building its tie-break only then.
 *
 * @param walk - The search state.
 * @param parts - The candidate's feasibility and misses.
 * @param bundles - The chosen bundles.
 */
function keepIfTop(
  walk: Walk,
  parts: Pick<RankKey, 'isUnknown' | 'misses'>,
  bundles: readonly SearchBundle[],
): void {
  const { top } = walk;
  const worst = top[MAX_SOLVER_OPTIONS - 1];
  if (worst !== undefined) {
    const order = comparePreferenceParts(parts, worst);
    if (order > 0 || (order === 0 && compareNumberLists(walk.ordinals, worst.ordinals) > 0)) return;
  }
  const candidate: FoundCandidate = {
    ...parts,
    ordinals: [...walk.ordinals],
    chosen: bundles.map((bundle) => bundle.index),
  };
  const position = top.findIndex((kept) => compareRankKeys(candidate, kept) < 0);
  // NOTE: a candidate that ranks below every kept one only gets here while fewer than three
  // are kept, because a full list already turned it away above.
  if (position === -1) {
    top.push(candidate);
    return;
  }
  top.splice(position, 0, candidate);
  top.length = Math.min(top.length, MAX_SOLVER_OPTIONS);
}

/**
 * Records a credit-load FAIL, keeping one candidate per distinct FAIL: the first in conflict
 * order.
 *
 * @param walk - The search state.
 * @param reasonCode - The FAIL's reason.
 * @param bundles - The candidate's bundles, in search order.
 */
function recordCreditConflict(
  walk: Walk,
  reasonCode: string,
  bundles: readonly SearchBundle[],
): void {
  // SAFETY: candidates whose bundles have the same course lists, in the same search order,
  // differ only in sections, which a credit-load check doesn't name; they give the same FAIL,
  // so it is one conflict, shown once and counted once, never filling the list with copies that
  // hide a distinct one (planning/08 §Constraint formulation: a verified conflict set;
  // ADR-0010 §5: the distinct FAIL results).
  const key = bundles.map((bundle) => bundle.courseListId).join(',');
  const kept = walk.creditConflicts.get(key);
  if (kept !== undefined && compareNumberLists(kept.ordinals, walk.ordinals) <= 0) return;
  walk.creditConflicts.set(key, {
    reasonCode,
    ordinals: [...walk.ordinals],
    chosen: bundles.map((bundle) => bundle.index),
  });
}

/**
 * Orders credit conflicts by reason code, then by the tie-break (ADR-0010 §5).
 *
 * @param first - One conflict.
 * @param second - The other.
 * @returns Negative when `first` comes first.
 */
function compareCreditConflicts(first: CreditConflict, second: CreditConflict): number {
  return (
    compareText(first.reasonCode, second.reasonCode) ||
    compareNumberLists(first.ordinals, second.ordinals)
  );
}
