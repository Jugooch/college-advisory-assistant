/**
 * @file The stable tie-break key of a set of sections: their IDs sorted by UTF-16 code unit.
 * @module @caa/engine/scheduling/tie-break-key
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type { SectionId } from '@caa/domain';

/** Separator below every character a section ID (a UUID) can contain. */
const SEPARATOR = '\n';

/**
 * Builds the tie-break key of a set of sections (ADR-0010 §4): the IDs sorted ascending by
 * UTF-16 code unit, never by locale, and joined by a separator that sorts below every ID
 * character. Comparing two keys with `<` then compares the sorted lists element by element,
 * and a proper prefix comes first.
 *
 * @param sectionIds - The sections, in any order.
 * @returns The key; equal keys mean the same set of sections.
 */
export function tieBreakKeyOf(sectionIds: readonly SectionId[]): string {
  return [...sectionIds].sort(compareText).join(SEPARATOR);
}

/**
 * Compares two strings by UTF-16 code unit, never by locale.
 *
 * @param first - One string.
 * @param second - The other.
 * @returns Negative, zero, or positive.
 */
export function compareText(first: string, second: string): number {
  if (first === second) return 0;
  return first < second ? -1 : 1;
}
