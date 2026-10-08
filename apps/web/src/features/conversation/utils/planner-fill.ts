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

import { slotFieldName } from '@/shared/utils/slot-field-name';
import { TIME_BLOCK_SLOTS } from '@/shared/utils/time-block-slots';

import { creditText } from './credit-text';

/** The result of filling a constraint into the form's query. */
export type FillResult =
  | { readonly kind: 'filled'; readonly params: URLSearchParams }
  | { readonly kind: 'present' }
  | { readonly kind: 'blocked'; readonly message: string };

const TIME_PARTS = ['day', 'start', 'end'] as const;
const MIN_FIELD = slotFieldName('credit-range', 'min');
const MAX_FIELD = slotFieldName('credit-range', 'max');
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
function setStrength(params: URLSearchParams, slot: string, constraint: ScheduleConstraint): void {
  params.set(slotFieldName(slot, 'strength'), constraint.strength);
  if (constraint.strength === ConstraintStrength.Preferred && constraint.priorityRank !== null) {
    params.set(slotFieldName(slot, 'rank'), String(constraint.priorityRank));
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
    params.append(slotFieldName(slot, 'day'), day);
  });
  if (constraint.startTime !== '00:00') {
    params.set(slotFieldName(slot, 'start'), constraint.startTime);
  }
  if (constraint.endTime !== '24:00') {
    params.set(slotFieldName(slot, 'end'), constraint.endTime);
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
      setStrength(params, 'credit-range', constraint);
      return null;
    case ScheduleConstraintKind.AllowedModalities:
      if (isUsed(params, ['modality'])) {
        return SLOT_USED;
      }
      constraint.modalities.forEach((value) => {
        params.append('modality', value);
      });
      setStrength(params, 'modality', constraint);
      return null;
    case ScheduleConstraintKind.AllowedCampuses:
      if (isUsed(params, ['campus'])) {
        return SLOT_USED;
      }
      params.set('campus', constraint.campusIds.join(', '));
      setStrength(params, 'campus', constraint);
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
 * Whether the form already holds a constraint with the same values, whatever its strength.
 *
 * @param current - The form's current query.
 * @param constraint - The constraint.
 * @returns `true` when one slot of the form already states it.
 */
function isPresent(current: URLSearchParams, constraint: ScheduleConstraint): boolean {
  const target = new URLSearchParams();
  const message =
    constraint.kind === ScheduleConstraintKind.UnavailableTime
      ? fillTime(target, constraint)
      : fillLimit(target, constraint);
  if (message !== null) {
    return false;
  }
  const same = (names: readonly string[], targetNames: readonly string[]): boolean =>
    names.every(
      (name, index) =>
        valuesOf(current, name).join('|') === valuesOf(target, targetNames[index] ?? '').join('|'),
    );
  if (constraint.kind === ScheduleConstraintKind.UnavailableTime) {
    const home = TIME_PARTS.map((part) => slotFieldName(TIME_BLOCK_SLOTS[0], part));
    return TIME_BLOCK_SLOTS.some((slot) =>
      same(
        TIME_PARTS.map((part) => slotFieldName(slot, part)),
        home,
      ),
    );
  }
  const fields = Array.from(new Set(target.keys())).filter(
    (name) => !name.endsWith('-strength') && !name.endsWith('-rank'),
  );
  return fields.some((name) => valuesOf(target, name).length > 0) && same(fields, fields);
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
  if (isPresent(current, constraint)) {
    return { kind: 'present' };
  }
  const params = new URLSearchParams(current);
  const message =
    constraint.kind === ScheduleConstraintKind.UnavailableTime
      ? fillTime(params, constraint)
      : fillLimit(params, constraint);
  if (message !== null) {
    return { kind: 'blocked', message };
  }
  params.set('step', 'edit');
  return { kind: 'filled', params };
}
