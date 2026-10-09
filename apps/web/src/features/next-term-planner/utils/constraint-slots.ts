/**
 * @file Turns each slot of the planner form into a raw constraint payload, or says why it can't.
 * Input parsing only: the domain schema decides whether the constraint is valid.
 * @module @caa/web/features/next-term-planner/utils/constraint-slots
 * @requirement FR-08
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { ConstraintStrength, ScheduleConstraintKind } from '@caa/domain';

import {
  readCreditBound as readCreditText,
  readPriorityRank,
  readTimeBounds,
  splitCampusIds,
} from '@/shared/utils/constraint-input';
import {
  CAMPUS_SLOT,
  type ConstraintSlot,
  CREDIT_RANGE_SLOT,
  MODALITY_SLOT,
  slotFieldName,
  SlotPart,
  TIME_BLOCK_SLOTS,
} from '@/shared/utils/planner-query-names';

import { type PlannerFormValues, type StrengthInput, type TimeBlockInput } from './planner-fields';

/** A field error: the field's query name and the message shown next to it. */
export type FieldError = readonly [name: string, message: string];

/** A raw constraint, not yet parsed. */
type Payload = Readonly<Record<string, unknown>>;

/** What one slot amounts to. */
export type SlotReading =
  /** The slot is empty: the student states nothing there. */
  | { readonly kind: 'unused' }
  /** A raw constraint for the domain schema to parse. */
  | { readonly kind: 'stated'; readonly payload: Payload }
  | { readonly kind: 'invalid'; readonly errors: readonly FieldError[] };

const RANK_MESSAGE = 'Enter a priority from 1 to 99, where 1 matters most.';

/**
 * Reads a slot's strength. Nothing sent means preferred, so no constraint becomes hard unless
 * the student chose it (planning/11 §Interaction details).
 *
 * @param slot - The constraint slot.
 * @param input - The typed strength and priority.
 * @returns The strength fields, or the field error that stops them.
 */
function readStrengthFields(slot: ConstraintSlot, input: StrengthInput): Payload | FieldError {
  if (input.strength === ConstraintStrength.Hard) {
    return { strength: ConstraintStrength.Hard, priorityRank: null };
  }
  if (input.strength !== '' && input.strength !== ConstraintStrength.Preferred) {
    return [slotFieldName(slot, SlotPart.Strength), 'Choose required or preferred.'];
  }
  const rank = readPriorityRank(input.rank);
  return rank === null
    ? [slotFieldName(slot, SlotPart.Rank), RANK_MESSAGE]
    : { strength: ConstraintStrength.Preferred, priorityRank: rank };
}

/**
 * Combines a slot's own fields with its strength, or reports the errors of both.
 *
 * @param slot - The constraint slot.
 * @param input - The typed strength and priority.
 * @param fields - The kind's own fields, or their errors.
 * @returns The slot's reading.
 */
function withStrength(
  slot: ConstraintSlot,
  input: StrengthInput,
  fields: Payload | readonly FieldError[],
): SlotReading {
  const strength = readStrengthFields(slot, input);
  const errors: FieldError[] = Array.isArray(fields) ? [...(fields as FieldError[])] : [];
  if (Array.isArray(strength)) {
    errors.unshift(strength as FieldError);
  }
  if (errors.length > 0) {
    return { kind: 'invalid', errors };
  }
  return { kind: 'stated', payload: { ...(fields as Payload), ...(strength as Payload) } };
}

/**
 * Reads one unavailable-time block. Blank times mean the whole day, so "no Fridays" is Friday
 * with no times; a blank end alone means until the end of the day.
 *
 * @param slot - The block's slot.
 * @param block - The typed block.
 * @returns The block's reading.
 */
function readTimeBlock(slot: ConstraintSlot, block: TimeBlockInput): SlotReading {
  if (block.days.length === 0) {
    const isBlank = block.start === '' && block.end === '';
    const error: FieldError = [
      slotFieldName(slot, SlotPart.Day),
      'Choose a day, or clear the times.',
    ];
    return isBlank ? { kind: 'unused' } : { kind: 'invalid', errors: [error] };
  }
  return withStrength(slot, block, {
    kind: ScheduleConstraintKind.UnavailableTime,
    weekdays: block.days,
    ...readTimeBounds(block.start, block.end),
  });
}

/**
 * Reads one typed credit bound.
 *
 * @param name - The field's query name.
 * @param text - The typed value.
 * @returns The hundredths, `null` when blank, or the field's error.
 */
function readCreditBound(name: string, text: string): number | null | FieldError {
  if (text === '') {
    return null;
  }
  return readCreditText(text) ?? [name, 'Enter a number of credits, such as 12 or 12.5.'];
}

/**
 * Reads the credit range. Both bounds blank means no range.
 *
 * @param range - The typed range.
 * @returns The range's reading.
 */
function readCreditRange(range: PlannerFormValues['creditRange']): SlotReading {
  if (range.min === '' && range.max === '') {
    return { kind: 'unused' };
  }
  const min = readCreditBound(slotFieldName(CREDIT_RANGE_SLOT, SlotPart.Min), range.min);
  const max = readCreditBound(slotFieldName(CREDIT_RANGE_SLOT, SlotPart.Max), range.max);
  const errors = [min, max].filter((bound) => Array.isArray(bound)) as FieldError[];
  const fields = {
    kind: ScheduleConstraintKind.CreditRange,
    minCreditsHundredths: min,
    maxCreditsHundredths: max,
  };
  return withStrength(CREDIT_RANGE_SLOT, range, errors.length > 0 ? errors : fields);
}

/**
 * Reads the modality choice. None chosen means no restriction.
 *
 * @param modality - The chosen modalities.
 * @returns The choice's reading.
 */
function readModalities(modality: PlannerFormValues['modality']): SlotReading {
  if (modality.values.length === 0) {
    return { kind: 'unused' };
  }
  return withStrength(MODALITY_SLOT, modality, {
    kind: ScheduleConstraintKind.AllowedModalities,
    modalities: modality.values,
  });
}

/**
 * Reads the campus list, separated by commas or spaces. Blank means no restriction.
 *
 * @param campus - The typed campus IDs.
 * @returns The list's reading.
 */
function readCampuses(campus: PlannerFormValues['campus']): SlotReading {
  const campusIds = splitCampusIds(campus.text);
  if (campusIds.length === 0) {
    return { kind: 'unused' };
  }
  return withStrength(CAMPUS_SLOT, campus, {
    kind: ScheduleConstraintKind.AllowedCampuses,
    campusIds,
  });
}

/**
 * Reads every slot of the form, in form order.
 *
 * @param values - The typed values.
 * @returns Each slot with its reading.
 */
export function readConstraintSlots(
  values: PlannerFormValues,
): readonly (readonly [ConstraintSlot, SlotReading])[] {
  return [
    ...TIME_BLOCK_SLOTS.map(
      (slot) => [slot, readTimeBlock(slot, values.timeBlocks[slot])] as const,
    ),
    [CREDIT_RANGE_SLOT, readCreditRange(values.creditRange)],
    [MODALITY_SLOT, readModalities(values.modality)],
    [CAMPUS_SLOT, readCampuses(values.campus)],
  ];
}
