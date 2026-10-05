/**
 * @file The ranking key of a bundle or schedule option, compared lexicographically (ADR-0010 §4).
 * @module @caa/engine/scheduling/schedule-rank
 * @requirement FR-08
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */

/** What an option or bundle is ranked by, best first in each part. */
export interface RankKey {
  /** Whether its schedule feasibility is UNKNOWN rather than PASS. */
  readonly isUnknown: boolean;
  /** 1 for each preference it misses, 0 for each it meets, in the student's priority order. */
  readonly misses: readonly number[];
  /**
   * Its section IDs' positions in the ID order of every section considered, sorted ascending:
   * comparing these compares the sorted section IDs by code unit (the tie-break).
   */
  readonly ordinals: readonly number[];
}

/**
 * Compares two number lists element by element; the first difference decides, and a proper
 * prefix comes first.
 *
 * @param first - One list.
 * @param second - The other.
 * @returns Negative when `first` comes first, positive when `second` does, zero when equal.
 */
export function compareNumberLists(first: readonly number[], second: readonly number[]): number {
  for (const [position, value] of first.entries()) {
    const other = second[position];
    if (other === undefined) return 1;
    if (value !== other) return value - other;
  }
  return first.length - second.length;
}

/**
 * Compares the feasibility and preference parts of two keys, without the tie-break.
 *
 * @param first - One key.
 * @param second - The other.
 * @returns Negative when `first` ranks higher, positive when lower, zero when tied so far.
 */
export function comparePreferenceParts(
  first: Pick<RankKey, 'isUnknown' | 'misses'>,
  second: Pick<RankKey, 'isUnknown' | 'misses'>,
): number {
  // SAFETY: a PASS schedule always ranks above an UNKNOWN one, so missing data never wins on
  // preferences (ADR-0010 §4, key 1).
  if (first.isUnknown !== second.isUnknown) {
    return first.isUnknown ? 1 : -1;
  }
  return compareNumberLists(first.misses, second.misses);
}

/**
 * Compares two ranking keys: feasibility, then preferences in priority order, then the
 * tie-break. Nothing else, such as labels or instructors, ever decides (ADR-0010 §4).
 *
 * @param first - One key.
 * @param second - The other.
 * @returns Negative when `first` ranks higher, positive when lower, zero for the same sections.
 */
export function compareRankKeys(first: RankKey, second: RankKey): number {
  return (
    comparePreferenceParts(first, second) || compareNumberLists(first.ordinals, second.ordinals)
  );
}
