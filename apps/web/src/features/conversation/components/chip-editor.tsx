'use client';
/**
 * @file The edit fields of one chip, by constraint kind. Saving checks the values with the
 * domain schema; an invalid edit is refused with a message and nothing changes.
 * @module @caa/web/features/conversation/components/chip-editor
 * @requirement FR-08
 * @requirement NFR-02
 */
import { type ReactElement, useState } from 'react';

import { ScheduleConstraintKind } from '@caa/domain';

import type { Chip, ConstraintChips } from '../hooks/use-constraint-chips';
import { applyDraft, type ChipDraft, draftFromConstraint } from '../utils/chip-draft';
import {
  CampusFields,
  CreditFields,
  type FieldsProps,
  ModalityFields,
  TextField,
  TimeFields,
} from './chip-fields';

/** Props for {@link ChipEditor}. */
export interface ChipEditorProps {
  readonly chip: Chip;
  readonly actions: ConstraintChips;
}

/**
 * Picks the field group for a constraint kind.
 *
 * @param kind - The constraint kind.
 * @returns The group's component.
 */
function fieldsFor(kind: ScheduleConstraintKind): (props: FieldsProps) => ReactElement {
  switch (kind) {
    case ScheduleConstraintKind.UnavailableTime:
      return TimeFields;
    case ScheduleConstraintKind.CreditRange:
      return CreditFields;
    case ScheduleConstraintKind.AllowedModalities:
      return ModalityFields;
    case ScheduleConstraintKind.AllowedCampuses:
      return CampusFields;
  }
}

/**
 * Renders the kind's fields, a priority field while preferred, and Save.
 *
 * @param props - The chip and the handlers.
 * @returns The editor.
 */
export function ChipEditor({ chip, actions }: ChipEditorProps): ReactElement {
  const { constraint } = chip;
  const [draft, setDraft] = useState<ChipDraft>(() => draftFromConstraint(constraint));
  const [message, setMessage] = useState<string | null>(null);
  const onChange = (change: Partial<ChipDraft>): void => {
    setDraft((current) => ({ ...current, ...change }));
  };
  const id = `chip-${String(chip.id)}`;
  const Fields = fieldsFor(constraint.kind);
  const save = (): void => {
    const result = applyDraft(constraint, draft);
    if (result.kind === 'valid') {
      actions.saveEdit(chip.id, result.constraint);
    } else {
      setMessage(result.message);
    }
  };
  return (
    <div className="chip__editor">
      <Fields id={id} draft={draft} onChange={onChange} />
      {constraint.priorityRank === null ? null : (
        <TextField
          id={`${id}-rank`}
          label="Priority if preferred (1 matters most)"
          inputMode="numeric"
          value={draft.rank}
          onChange={(rank) => {
            onChange({ rank });
          }}
        />
      )}
      {message === null ? null : (
        <p role="alert" className="field-error">
          {message}
        </p>
      )}
      <button type="button" onClick={save}>
        Save changes
      </button>
    </div>
  );
}
