/**
 * @file Checks every pair of bundles from different courses once, before the search.
 * @module @caa/engine/scheduling/bundle-pair-table
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  type CampusTransitionPolicy,
  CheckState,
  SCHEDULE_REASON_STATE,
  type ScheduleIssue,
  type Section,
} from '@caa/domain';

import { findMeetingIssues } from './find-meeting-conflicts';
import { toScheduleFeasibilityCheck } from './schedule-feasibility-check';
import type { ConflictEntry } from './screen-bundles';
import { tieBreakKeyOf } from './tie-break-key';

/** What two bundles of different courses give when taken together. */
export interface PairVerdict {
  /** The first conflicting section pair's FAIL, or `null` when none conflicts. */
  readonly fail: ConflictEntry | null;
  /** Every UNKNOWN issue between their sections. */
  readonly unknownIssues: readonly ScheduleIssue[];
}

/** One bundle's sections and the requested course it serves. */
export interface PairTableBundle {
  readonly requestIndex: number;
  readonly sections: readonly Section[];
}

/** Verdicts for every pair of bundles from different courses. */
export interface PairTable {
  /**
   * The verdict for two bundles.
   *
   * @param first - One bundle's position in the table's list.
   * @param second - The other's; from a different course.
   * @returns The verdict, the same in either order.
   */
  readonly verdictOf: (first: number, second: number) => PairVerdict;
}

/** The verdict of bundles that share no conflict and no unknown. */
const COMPATIBLE: PairVerdict = { fail: null, unknownIssues: [] };

/**
 * Checks every pair of bundles from different courses, comparing each pair of their sections
 * once.
 *
 * @param bundles - Every bundle the search can choose, in a stable order.
 * @param transitionPolicy - The tenant's transition table, or `null`.
 * @returns The table.
 */
export function buildPairTable(
  bundles: readonly PairTableBundle[],
  transitionPolicy: CampusTransitionPolicy | null,
): PairTable {
  const sectionPairs = new Map<string, readonly ScheduleIssue[]>();
  const issuesBetween = (first: Section, second: Section): readonly ScheduleIssue[] => {
    const key = tieBreakKeyOf([first.id, second.id]);
    const known = sectionPairs.get(key);
    if (known !== undefined) return known;
    const issues = findMeetingIssues({ first, second, transitionPolicy });
    sectionPairs.set(key, issues);
    return issues;
  };
  const count = bundles.length;
  const verdicts = bundles.flatMap((first, row) =>
    bundles.map((second, column) =>
      column <= row || first.requestIndex === second.requestIndex
        ? COMPATIBLE
        : verdictBetween(first.sections, second.sections, issuesBetween),
    ),
  );
  return {
    verdictOf: (first, second) =>
      verdicts[Math.min(first, second) * count + Math.max(first, second)] ?? COMPATIBLE,
  };
}

/**
 * Checks two bundles' sections against each other.
 *
 * @param first - One bundle's sections.
 * @param second - The other's.
 * @param issuesBetween - The cached comparison of two sections.
 * @returns The verdict.
 */
function verdictBetween(
  first: readonly Section[],
  second: readonly Section[],
  issuesBetween: (one: Section, other: Section) => readonly ScheduleIssue[],
): PairVerdict {
  const pairs = first.flatMap((one) =>
    second.map((other) => ({ sections: [one, other], issues: issuesBetween(one, other) })),
  );
  const isFail = (issue: ScheduleIssue): boolean =>
    SCHEDULE_REASON_STATE[issue.reasonCode] === CheckState.Fail;
  const failing = pairs.find((pair) => pair.issues.some(isFail));
  // SAFETY: a proven meeting or travel conflict between two chosen sections rules the pair out
  // whatever else is unknown, and its FAIL is the verified evidence (ADR-0010 §3 and §5).
  if (failing !== undefined) {
    const check = toScheduleFeasibilityCheck(failing.issues);
    const fail: ConflictEntry = {
      reasonCode: String(check.reasonCode),
      key: tieBreakKeyOf(failing.sections.map((section) => section.id)),
      check,
    };
    return { fail, unknownIssues: [] };
  }
  const unknownIssues = pairs.flatMap((pair) => pair.issues);
  return unknownIssues.length === 0 ? COMPATIBLE : { fail: null, unknownIssues };
}
