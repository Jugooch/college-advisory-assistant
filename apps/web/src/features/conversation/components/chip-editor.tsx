'use client';
/**
 * @file The edit fields of one chip, by constraint kind. Saving checks the values with the
 * domain schema; an invalid edit is refused with a message and nothing changes.
 * @module @caa/web/features/conversation/components/chip-editor
 * @requirement FR-08
 * @requirement NFR-02
 */
import { type ReactElement, useEffect, useRef, useState } from 'react';

import { ScheduleConstraintKind } from '@caa/domain';

import type { Chip, ConstraintChips } from '../hooks/use-constraint-chips';
import {
  applyDraft,
  type ChipDraft,
  type ChipFieldsProps,
  draftFromConstraint,
} from '../utils/chip-draft';
import { CampusFields } from './campus-fields';
import { CreditFields } from './credit-fields';
import { ModalityFields } from './modality-fields';
import { TextField } from './text-field';
import { TimeFields } from './time-fields';

/** Props for {@link ChipEditor}. */
export interface ChipEditorProps {
  readonly chip: Chip;
  readonly actions: ConstraintChips;
  /** Called after a valid edit is saved and the editor closes. */
  readonly onSaved: () => void;
}

/**
 * Picks the field group for a constraint kind.
 *
 * @param kind - The constraint kind.
 * @returns The group's component.
 */
function fieldsFor(kind: ScheduleConstraintKind): (props: ChipFieldsProps) => ReactElement {
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
export function ChipEditor({ chip, actions, onSaved }: ChipEditorProps): ReactElement {
  const { constraint } = chip;
  const [draft, setDraft] = useState<ChipDraft>(() => draftFromConstraint(constraint));
  const [message, setMessage] = useState<string | null>(null);
  // Counts failed saves, so focus moves to the field again on every failed attempt.
  const [failures, setFailures] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (failures > 0) {
      editorRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [failures]);
  const onChange = (change: Partial<ChipDraft>): void => {
    setDraft((current) => ({ ...current, ...change }));
  };
  const id = `chip-${String(chip.id)}`;
  const errorId = message === null ? null : `${id}-error`;
  const Fields = fieldsFor(constraint.kind);
  const save = (): void => {
    const result = applyDraft(constraint, draft);
    if (result.kind === 'valid') {
      actions.saveEdit(chip.id, result.constraint);
      onSaved();
    } else {
      setMessage(result.message);
      setFailures((count) => count + 1);
    }
  };
  return (
    <div className="chip__editor" ref={editorRef}>
      <Fields id={id} draft={draft} errorId={errorId} onChange={onChange} />
      {constraint.priorityRank === null ? null : (
        <TextField
          id={`${id}-rank`}
          label="Priority if preferred"
          hint="A whole number. 1 matters most."
          inputMode="numeric"
          value={draft.rank}
          errorId={errorId}
          onChange={(rank) => {
            onChange({ rank });
          }}
        />
      )}
      {message === null ? null : (
        <p id={errorId ?? undefined} role="alert" className="field-error">
          {message}
        </p>
      )}
      <button type="button" onClick={save}>
        Save changes
      </button>
    </div>
  );
}
