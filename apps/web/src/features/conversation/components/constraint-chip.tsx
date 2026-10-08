/**
 * @file One proposed constraint: its meaning in words, a labelled required-or-preferred choice,
 * and Edit, Dismiss and Confirm. Strength is stated in words, never by color alone.
 * @module @caa/web/features/conversation/components/constraint-chip
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import { ConstraintStrength } from '@caa/domain';

import { describeConstraint } from '@/shared/utils/constraint-wording';

import type { Chip, ConstraintChips } from '../hooks/use-constraint-chips';
import { ChipEditor } from './chip-editor';

/** Props for {@link ConstraintChip}. */
export interface ConstraintChipProps {
  readonly chip: Chip;
  readonly actions: ConstraintChips;
}

/**
 * The required-or-preferred choice, labelled and named in words.
 *
 * @param props - The chip, its current strength in words, and the handlers.
 * @returns The fieldset.
 */
function StrengthChoice({
  chip,
  strength,
  actions,
}: ConstraintChipProps & { readonly strength: string }): ReactElement {
  const name = `chip-${String(chip.id)}-strength`;
  const isHard = chip.constraint.strength === ConstraintStrength.Hard;
  const options = [
    { value: ConstraintStrength.Preferred, label: 'Preferred', isChecked: !isHard },
    { value: ConstraintStrength.Hard, label: 'Required (hard)', isChecked: isHard },
  ];
  return (
    <fieldset>
      <legend>How firm is this? Currently: {strength}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            checked={option.isChecked}
            onChange={() => {
              actions.setStrength(chip.id, option.value);
            }}
          />{' '}
          {option.label}{' '}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Renders the chip, or a one-line outcome once it is confirmed or dismissed.
 *
 * @param props - The chip and the handlers.
 * @returns The list entry.
 */
export function ConstraintChip({ chip, actions }: ConstraintChipProps): ReactElement {
  const { statement, strength } = describeConstraint(chip.constraint);
  if (chip.status !== 'pending') {
    return (
      <li className="chip">
        <p>
          {statement} ({strength}) —{' '}
          {chip.status === 'confirmed' ? 'added to the form.' : 'dismissed, nothing changed.'}
        </p>
      </li>
    );
  }
  return (
    <li className="chip">
      <p className="chip__statement">{statement}</p>
      <StrengthChoice chip={chip} strength={strength} actions={actions} />
      {chip.isEditing ? <ChipEditor chip={chip} actions={actions} /> : null}
      {chip.problem === null ? null : (
        <p role="alert" className="notice notice--caution">
          {chip.problem}
        </p>
      )}
      <p className="chip__actions">
        <button
          type="button"
          aria-expanded={chip.isEditing}
          onClick={() => {
            actions.setEditing(chip.id, !chip.isEditing);
          }}
        >
          Edit
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            actions.dismiss(chip.id);
          }}
        >
          Dismiss
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            actions.confirm(chip.id);
          }}
        >
          Confirm
        </button>
      </p>
    </li>
  );
}
