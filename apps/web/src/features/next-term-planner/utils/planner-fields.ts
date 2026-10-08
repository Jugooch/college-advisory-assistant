/**
 * @file The planner form's raw values and element ids. The step, slot and query names live in
 * `shared/utils/planner-query-names`. Names only; nothing here is validated.
 * The raw values a submission carries. Names only; nothing here is validated.
 * @module @caa/web/features/next-term-planner/utils/planner-fields
 * @requirement FR-08
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import {
  CONSTRAINT_SLOTS,
  type ConstraintSlot,
  type TIME_BLOCK_SLOTS,
} from '@/shared/utils/planner-query-names';

/** How strict a slot is and its priority, as typed. */
export interface StrengthInput {
  /** `HARD`, `PREFERRED`, or empty when not sent, which means preferred. */
  readonly strength: string;
  /** The typed priority, 1 first. Used only for a preference. */
  readonly rank: string;
}

/** One unavailable-time block, as typed. */
export interface TimeBlockInput extends StrengthInput {
  readonly days: readonly string[];
  /** `HH:MM`, or empty for the start of the day. */
  readonly start: string;
  /** `HH:MM`, or empty for the end of the day. */
  readonly end: string;
}

/** Every value of a planner submission, as typed, so the form can be filled again. */
export interface PlannerFormValues {
  readonly termId: string;
  /** The chosen course values, once each, in submitted order. */
  readonly courseIds: readonly string[];
  /** Typed credit text by course ID. */
  readonly creditInputs: ReadonlyMap<string, string>;
  readonly timeBlocks: Readonly<Record<(typeof TIME_BLOCK_SLOTS)[number], TimeBlockInput>>;
  readonly creditRange: StrengthInput & { readonly min: string; readonly max: string };
  readonly modality: StrengthInput & { readonly values: readonly string[] };
  readonly campus: StrengthInput & { readonly text: string };
}

/**
 * Names the element id of one field, so errors can link to it.
 *
 * @param name - The field's query name, for example `term` or `block1-start`.
 * @returns For example `planner-block1-start`.
 */
export function plannerFieldId(name: string): string {
  return `planner-${name}`;
}

/**
 * Gives a slot's default priority: its position in the form, 1 first. The student sees it in
 * the field and can change it before reviewing.
 *
 * @param slot - The constraint slot.
 * @returns The default priority text.
 */
export function defaultRank(slot: ConstraintSlot): string {
  return String(CONSTRAINT_SLOTS.indexOf(slot) + 1);
}
