/**
 * @file Names the planner form's query field for one part of a constraint slot, so the form and
 * the conversation's chip fill share one name format.
 * @module @caa/web/shared/utils/slot-field-name
 * @requirement FR-08
 */

/**
 * Names the query field of one part of a slot.
 *
 * @param slot - The constraint slot, for example `block1` or `credit-range`.
 * @param part - The part, for example `strength` or `start`.
 * @returns For example `block1-start`.
 */
export function slotFieldName(slot: string, part: string): string {
  return `${slot}-${part}`;
}
