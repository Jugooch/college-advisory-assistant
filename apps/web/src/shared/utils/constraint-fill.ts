/**
 * @file Writes one confirmed schedule constraint into the planner form's query, in the form's
 * own field names. It never overwrites a slot the student already filled.
 * @module @caa/web/shared/utils/constraint-fill
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { ConstraintStrength, type ScheduleConstraint, ScheduleConstraintKind } from '@caa/domain';

import { formatCredits } from './format-display';

/** The result of filling a constraint into the form's query. */
export type FillResult =
  | { readonly kind: 'filled'; readonly params: URLSearchParams }
  | { readonly kind: 'blocked'; readonly message: string };

/** The unavailable-time slots of the planner form, in form order. */
const TIME_SLOTS = ['block1', 'block2', 'block3'] as const;

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
  params.set(`${slot}-strength`, constraint.strength);
  if (constraint.strength === ConstraintStrength.Preferred && constraint.priorityRank !== null) {
    params.set(`${slot}-rank`, String(constraint.priorityRank));
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
  const slot = TIME_SLOTS.find(
    (name) => !isUsed(params, [`${name}-day`, `${name}-start`, `${name}-end`]),
  );
  if (slot === undefined) {
    return TIME_FULL;
  }
  constraint.weekdays.forEach((day) => {
    params.append(`${slot}-day`, day);
  });
  if (constraint.startTime !== '00:00') {
    params.set(`${slot}-start`, constraint.startTime);
  }
  if (constraint.endTime !== '24:00') {
    params.set(`${slot}-end`, constraint.endTime);
  }
  setStrength(params, slot, constraint);
  return null;
}

/**
 * Formats an optional credit bound for the form's text field.
 *
 * @param hundredths - The bound, or null.
 * @returns The text, blank for no bound.
 */
function creditText(hundredths: number | null): string {
  return hundredths === null ? '' : formatCredits(hundredths);
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
      if (isUsed(params, ['credit-range-min', 'credit-range-max'])) {
        return SLOT_USED;
      }
      params.set('credit-range-min', creditText(constraint.minCreditsHundredths));
      params.set('credit-range-max', creditText(constraint.maxCreditsHundredths));
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
 * Writes a confirmed constraint into a copy of the form's query and returns to the form step,
 * so the student reviews and confirms the search again before anything runs.
 *
 * @param current - The planner page's current query.
 * @param constraint - The constraint the student confirmed.
 * @returns The new query, or why the constraint can't be placed.
 */
export function fillPlannerQuery(
  current: URLSearchParams,
  constraint: ScheduleConstraint,
): FillResult {
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
