/**
 * @file The editable text of one constraint chip, and the check that turns an edit back into a
 * valid constraint. The domain schema decides validity; nothing is repaired or guessed.
 * @module @caa/web/features/conversation/utils/chip-draft
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import {
  ConstraintStrength,
  type ScheduleConstraint,
  ScheduleConstraintKind,
  ScheduleConstraintSchema,
} from '@caa/domain';

import { parseCreditText } from '@/shared/utils/credit-choice';

import { creditText } from './credit-text';

/** What the student can edit on a chip, as typed. */
export interface ChipDraft {
  readonly days: readonly string[];
  readonly start: string;
  readonly end: string;
  readonly min: string;
  readonly max: string;
  readonly modalities: readonly string[];
  readonly campuses: string;
  /** Priority, used while the chip is preferred. */
  readonly rank: string;
}

/** Props shared by the chip edit field groups. */
export interface ChipFieldsProps {
  readonly id: string;
  readonly draft: ChipDraft;
  /** The id of the error message shown for this edit, or `null` when there is none. */
  readonly errorId: string | null;
  readonly onChange: (change: Partial<ChipDraft>) => void;
}

/** The outcome of applying an edit. */
export type DraftResult =
  | { readonly kind: 'valid'; readonly constraint: ScheduleConstraint }
  | { readonly kind: 'invalid'; readonly message: string };

const INVALID = 'These values don’t make a valid limit. Check the fields and try again.';

/**
 * Starts an edit from a constraint.
 *
 * @param constraint - The constraint as shown.
 * @returns Its editable text.
 */
export function draftFromConstraint(constraint: ScheduleConstraint): ChipDraft {
  const empty: ChipDraft = {
    days: [],
    start: '',
    end: '',
    min: '',
    max: '',
    modalities: [],
    campuses: '',
    rank: String(constraint.priorityRank ?? 1),
  };
  switch (constraint.kind) {
    case ScheduleConstraintKind.UnavailableTime:
      return {
        ...empty,
        days: constraint.weekdays,
        start: constraint.startTime,
        end: constraint.endTime,
      };
    case ScheduleConstraintKind.CreditRange:
      return {
        ...empty,
        min: creditText(constraint.minCreditsHundredths),
        max: creditText(constraint.maxCreditsHundredths),
      };
    case ScheduleConstraintKind.AllowedModalities:
      return { ...empty, modalities: constraint.modalities };
    case ScheduleConstraintKind.AllowedCampuses:
      return { ...empty, campuses: constraint.campusIds.join(', ') };
  }
}

/**
 * Reads one typed credit bound.
 *
 * @param text - The typed value.
 * @returns The hundredths, null when blank, or undefined when not a number.
 */
function readBound(text: string): number | null | undefined {
  return text.trim() === '' ? null : (parseCreditText(text.trim()) ?? undefined);
}

/**
 * Builds the raw kind-specific fields from the draft.
 *
 * @param constraint - The constraint being edited.
 * @param draft - The typed values.
 * @returns The raw fields, or `null` when a credit bound isn't a number.
 */
function kindFields(constraint: ScheduleConstraint, draft: ChipDraft): object | null {
  switch (constraint.kind) {
    case ScheduleConstraintKind.UnavailableTime:
      return {
        weekdays: draft.days,
        startTime: draft.start || '00:00',
        endTime: draft.end || '24:00',
      };
    case ScheduleConstraintKind.CreditRange: {
      const min = readBound(draft.min);
      const max = readBound(draft.max);
      return min === undefined || max === undefined
        ? null
        : { minCreditsHundredths: min, maxCreditsHundredths: max };
    }
    case ScheduleConstraintKind.AllowedModalities:
      return { modalities: draft.modalities };
    case ScheduleConstraintKind.AllowedCampuses:
      return { campusIds: draft.campuses.split(/[\s,]+/).filter((id) => id !== '') };
  }
}

/**
 * Applies an edit. The chip keeps its current strength; only the student's toggle changes it.
 *
 * @param constraint - The constraint being edited.
 * @param draft - The typed values.
 * @returns The valid constraint, or why the edit can't be used.
 */
export function applyDraft(constraint: ScheduleConstraint, draft: ChipDraft): DraftResult {
  const fields = kindFields(constraint, draft);
  const rank = /^\d{1,2}$/.test(draft.rank) ? Number(draft.rank) : 0;
  if (fields === null || (constraint.strength === ConstraintStrength.Preferred && rank < 1)) {
    return { kind: 'invalid', message: INVALID };
  }
  const parsed = ScheduleConstraintSchema.safeParse({
    kind: constraint.kind,
    strength: constraint.strength,
    priorityRank: constraint.strength === ConstraintStrength.Hard ? null : rank,
    ...fields,
  });
  return parsed.success
    ? { kind: 'valid', constraint: parsed.data }
    : { kind: 'invalid', message: INVALID };
}

/**
 * Changes a chip's strength. A preference keeps the given priority.
 *
 * @param constraint - The constraint.
 * @param strength - The strength the student chose.
 * @param rank - The priority to use when it becomes preferred.
 * @returns The constraint with that strength.
 */
export function withStrength(
  constraint: ScheduleConstraint,
  strength: ConstraintStrength,
  rank: number,
): ScheduleConstraint {
  return {
    ...constraint,
    strength,
    priorityRank: strength === ConstraintStrength.Hard ? null : rank,
  };
}
