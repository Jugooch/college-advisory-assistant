/**
 * @file The planner form's query names: the step field and its values, the constraint slots, and
 * how a slot's field is named. The planner form and the conversation's chip fill both build every
 * name from here, so the planner URL format has one source of truth.
 * @module @caa/web/shared/utils/planner-query-names
 * @requirement FR-08
 * @see docs/adr/0007-web-feature-and-shared-layout.md
 */

/** The query field that says which step of the planner a submission asks for. */
export const STEP_FIELD = 'step';

/** Which step of the planner a submission asks for. */
export const PlannerStep = {
  /** Show the form, filled with the submitted values. */
  Edit: 'edit',
  /** Check the values and list the constraints for the student to confirm. */
  Review: 'review',
  /** Search with the confirmed constraints. */
  Search: 'search',
} as const;

/** Union of every {@link PlannerStep} value. */
export type PlannerStep = (typeof PlannerStep)[keyof typeof PlannerStep];

/** The unavailable-time block slots the form offers, in form order. */
export const TIME_BLOCK_SLOTS = ['block1', 'block2', 'block3'] as const;

/** The credit-range slot. Its value fields are `credit-range-min` and `credit-range-max`. */
export const CREDIT_RANGE_SLOT = 'credit-range';

/** The modality slot. Its value field has the slot's own name. */
export const MODALITY_SLOT = 'modality';

/** The campus slot. Its value field has the slot's own name. */
export const CAMPUS_SLOT = 'campus';

/** One constraint slot of the form; each slot states at most one constraint. */
export type ConstraintSlot =
  | (typeof TIME_BLOCK_SLOTS)[number]
  | typeof CREDIT_RANGE_SLOT
  | typeof MODALITY_SLOT
  | typeof CAMPUS_SLOT;

/** Every constraint slot, in form order, which is also the order of the default priorities. */
export const CONSTRAINT_SLOTS: readonly ConstraintSlot[] = [
  ...TIME_BLOCK_SLOTS,
  CREDIT_RANGE_SLOT,
  MODALITY_SLOT,
  CAMPUS_SLOT,
];

/** The parts of a slot that have their own query field. */
export const SlotPart = {
  Day: 'day',
  Start: 'start',
  End: 'end',
  Min: 'min',
  Max: 'max',
  Strength: 'strength',
  Rank: 'rank',
} as const;

/** Union of every {@link SlotPart} value. */
export type SlotPart = (typeof SlotPart)[keyof typeof SlotPart];

/**
 * Names the query field of one part of a slot.
 *
 * @param slot - The constraint slot.
 * @param part - The part, for example `strength` or `start`.
 * @returns For example `block1-start`.
 */
export function slotFieldName(slot: ConstraintSlot, part: SlotPart): string {
  return `${slot}-${part}`;
}
