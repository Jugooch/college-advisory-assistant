/**
 * @file Writes one confirmed schedule constraint into the planner form's query, in the form's
 * own field names. It never overwrites a slot the student already filled, and it recognizes a
 * constraint the form already has so a second Confirm adds nothing twice.
 * @module @caa/web/features/conversation/utils/planner-fill
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { ConstraintStrength, type ScheduleConstraint, ScheduleConstraintKind } from '@caa/domain';

import {
  CAMPUS_SLOT,
  type ConstraintSlot,
  CREDIT_RANGE_SLOT,
  MODALITY_SLOT,
  PlannerStep,
  slotFieldName,
  SlotPart,
  STEP_FIELD,
  TIME_BLOCK_SLOTS,
} from '@/shared/utils/planner-query-names';

import { creditText } from './credit-text';

/** The slot each limit kind fills. */
const LIMIT_SLOT: Readonly<
  Record<Exclude<ScheduleConstraint['kind'], 'UNAVAILABLE_TIME'>, ConstraintSlot>
> = {
  [ScheduleConstraintKind.CreditRange]: CREDIT_RANGE_SLOT,
  [ScheduleConstraintKind.AllowedModalities]: MODALITY_SLOT,
  [ScheduleConstraintKind.AllowedCampuses]: CAMPUS_SLOT,
};

/** The result of filling a constraint into the form's query. */
export type FillResult =
  | { readonly kind: 'filled'; readonly params: URLSearchParams }
  | { readonly kind: 'present' }
  | { readonly kind: 'blocked'; readonly message: string };

const TIME_PARTS = [SlotPart.Day, SlotPart.Start, SlotPart.End] as const;
const MIN_FIELD = slotFieldName(CREDIT_RANGE_SLOT, SlotPart.Min);
const MAX_FIELD = slotFieldName(CREDIT_RANGE_SLOT, SlotPart.Max);
const TIME_FULL = 'All three unavailable-time slots on the form are already used.';
const SLOT_USED = 'The form already has an entry for this. Change or clear it on the form first.';

/**
 * Whether the form already has any value in a slot.
 *
 * @param params - The form's query.
 * @param names - The slot's field names.
 * @returns `true` when one of them has a non-blank value.
 */
function isUsed(params: URLSearchParams, names: readonly string[]): boolean {
  return names.some((name) => params.getAll(name).some((value) => value.trim() !== ''));
}

/**
 * Sets a slot's strength and, for a preference, its priority.
 *
 * @param params - The query to change.
 * @param slot - The slot name.
 * @param constraint - The constraint.
 */
function setStrength(
  params: URLSearchParams,
  slot: ConstraintSlot,
  constraint: ScheduleConstraint,
): void {
  params.set(slotFieldName(slot, SlotPart.Strength), constraint.strength);
  if (constraint.strength === ConstraintStrength.Preferred && constraint.priorityRank !== null) {
    params.set(slotFieldName(slot, SlotPart.Rank), String(constraint.priorityRank));
  }
}

/**
 * Fills an unavailable-time constraint into the first free block.
 *
 * @param params - The query to change.
 * @param constraint - The constraint.
 * @returns A message when no block is free, otherwise `null`.
 */
function fillTime(
  params: URLSearchParams,
  constraint: Extract<ScheduleConstraint, { kind: 'UNAVAILABLE_TIME' }>,
): string | null {
  const slot = TIME_BLOCK_SLOTS.find(
    (name) =>
      !isUsed(
        params,
        TIME_PARTS.map((part) => slotFieldName(name, part)),
      ),
  );
  if (slot === undefined) {
    return TIME_FULL;
  }
  constraint.weekdays.forEach((day) => {
    params.append(slotFieldName(slot, SlotPart.Day), day);
  });
  if (constraint.startTime !== '00:00') {
    params.set(slotFieldName(slot, SlotPart.Start), constraint.startTime);
  }
  if (constraint.endTime !== '24:00') {
    params.set(slotFieldName(slot, SlotPart.End), constraint.endTime);
  }
  setStrength(params, slot, constraint);
  return null;
}

/**
 * Fills the credit range, modality or campus slot.
 *
 * @param params - The query to change.
 * @param constraint - A constraint that is not an unavailable time.
 * @returns A message when the slot is used, otherwise `null`.
 */
function fillLimit(
  params: URLSearchParams,
  constraint: Exclude<ScheduleConstraint, { kind: 'UNAVAILABLE_TIME' }>,
): string | null {
  switch (constraint.kind) {
    case ScheduleConstraintKind.CreditRange:
      if (isUsed(params, [MIN_FIELD, MAX_FIELD])) {
        return SLOT_USED;
      }
      params.set(MIN_FIELD, creditText(constraint.minCreditsHundredths));
      params.set(MAX_FIELD, creditText(constraint.maxCreditsHundredths));
      setStrength(params, CREDIT_RANGE_SLOT, constraint);
      return null;
    case ScheduleConstraintKind.AllowedModalities:
      if (isUsed(params, [MODALITY_SLOT])) {
        return SLOT_USED;
      }
      constraint.modalities.forEach((value) => {
        params.append(MODALITY_SLOT, value);
      });
      setStrength(params, MODALITY_SLOT, constraint);
      return null;
    case ScheduleConstraintKind.AllowedCampuses:
      if (isUsed(params, [CAMPUS_SLOT])) {
        return SLOT_USED;
      }
      params.set(CAMPUS_SLOT, constraint.campusIds.join(', '));
      setStrength(params, CAMPUS_SLOT, constraint);
      return null;
  }
}

/**
 * The non-blank values of a field, in a stable order.
 *
 * @param params - The query.
 * @param name - The field name.
 * @returns The values.
 */
function valuesOf(params: URLSearchParams, name: string): readonly string[] {
  return params
    .getAll(name)
    .map((value) => value.trim())
    .filter((value) => value !== '')
    .sort();
}

/**
 * Finds the slot of the form that already holds a constraint with the same values, whatever its
 * strength.
 *
 * @param current - The form's current query.
 * @param constraint - The constraint.
 * @returns The slot that states it, or `null` when no slot does.
 */
function findPresentSlot(
  current: URLSearchParams,
  constraint: ScheduleConstraint,
): ConstraintSlot | null {
  const target = new URLSearchParams();
  const message =
    constraint.kind === ScheduleConstraintKind.UnavailableTime
      ? fillTime(target, constraint)
      : fillLimit(target, constraint);
  if (message !== null) {
    return null;
  }
  const same = (names: readonly string[], targetNames: readonly string[]): boolean =>
    names.every(
      (name, index) =>
        valuesOf(current, name).join('|') === valuesOf(target, targetNames[index] ?? '').join('|'),
    );
  if (constraint.kind === ScheduleConstraintKind.UnavailableTime) {
    const home = TIME_PARTS.map((part) => slotFieldName(TIME_BLOCK_SLOTS[0], part));
    return (
      TIME_BLOCK_SLOTS.find((slot) =>
        same(
          TIME_PARTS.map((part) => slotFieldName(slot, part)),
          home,
        ),
      ) ?? null
    );
  }
  const fields = Array.from(new Set(target.keys())).filter(
    (name) => !name.endsWith(`-${SlotPart.Strength}`) && !name.endsWith(`-${SlotPart.Rank}`),
  );
  const isSame = fields.some((name) => valuesOf(target, name).length > 0) && same(fields, fields);
  return isSame ? LIMIT_SLOT[constraint.kind] : null;
}

/**
 * Tells how a constraint the form already holds compares with the one the student confirmed.
 *
 * @param current - The form's current query.
 * @param constraint - The constraint.
 * @param slot - The slot that holds it.
 * @returns `present` when the strengths agree, otherwise `blocked`, so the chip never states a
 *   strength the form doesn't hold.
 */
function comparePresent(
  current: URLSearchParams,
  constraint: ScheduleConstraint,
  slot: ConstraintSlot,
): FillResult {
  const held =
    current.get(slotFieldName(slot, SlotPart.Strength)) === ConstraintStrength.Hard
      ? ConstraintStrength.Hard
      : ConstraintStrength.Preferred;
  if (held === constraint.strength) {
    return { kind: 'present' };
  }
  const wording = held === ConstraintStrength.Hard ? 'Required' : 'Preferred';
  return {
    kind: 'blocked',
    message: `The form already has this as ${wording}. Change its strength on the form.`,
  };
}

/**
 * Writes a confirmed constraint into a copy of the form's query and returns to the form step,
 * so the student reviews and confirms the search again before anything runs.
 *
 * @param current - The planner page's current query.
 * @param constraint - The constraint the student confirmed.
 * @returns The new query, that the form already has it, or why the constraint can't be placed.
 */
export function fillPlannerQuery(
  current: URLSearchParams,
  constraint: ScheduleConstraint,
): FillResult {
  const presentSlot = findPresentSlot(current, constraint);
  if (presentSlot !== null) {
    return comparePresent(current, constraint, presentSlot);
  }
  const params = new URLSearchParams(current);
  const message =
    constraint.kind === ScheduleConstraintKind.UnavailableTime
      ? fillTime(params, constraint)
      : fillLimit(params, constraint);
  if (message !== null) {
    return { kind: 'blocked', message };
  }
  params.set(STEP_FIELD, PlannerStep.Edit);
  return { kind: 'filled', params };
}
