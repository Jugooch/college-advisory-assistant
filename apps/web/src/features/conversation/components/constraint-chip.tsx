/**
 * @file One proposed constraint: its meaning in words, a labelled required-or-preferred choice,
 * and Edit, Dismiss and Confirm. Strength is stated in words, never by color alone.
 * @module @caa/web/features/conversation/components/constraint-chip
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { type ReactElement, useEffect, useRef, useState } from 'react';

import { ConstraintStrength } from '@caa/domain';

import { describeConstraint } from '@/shared/utils/constraint-wording';

import type { Chip, ConstraintChips } from '../hooks/use-constraint-chips';
import { ChipEditor } from './chip-editor';

/** Props for {@link ConstraintChip}. */
export interface ConstraintChipProps {
  readonly chip: Chip;
  readonly actions: ConstraintChips;
}

/** Props for the strength choice. */
type StrengthChoiceProps = ConstraintChipProps;

/** Props for the outcome line. */
interface ChipOutcomeProps {
  readonly text: string;
  /** Whether focus moves here on mount, because the student just acted on the chip. */
  readonly isFocused: boolean;
}

/**
 * The one-line outcome of a chip. It takes focus after Confirm or Dismiss, so a keyboard or
 * screen-reader user stays at the chip instead of being dropped to the top of the page.
 *
 * @param props - The text and whether to take focus.
 * @returns The list entry.
 */
function ChipOutcome({ text, isFocused }: ChipOutcomeProps): ReactElement {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
    }
  }, [isFocused]);
  return (
    <li className="chip" ref={ref} tabIndex={-1}>
      <p>{text}</p>
    </li>
  );
}

/**
 * The id of a chip's statement, so its controls can be tied to it.
 *
 * @param chip - The chip.
 * @returns The statement's element id.
 */
function statementIdOf(chip: Chip): string {
  return `chip-${String(chip.id)}-statement`;
}

/**
 * The required-or-preferred choice, labelled and named in words.
 *
 * @param props - The chip and the handlers.
 * @returns The fieldset.
 */
function StrengthChoice({ chip, actions }: StrengthChoiceProps): ReactElement {
  const statementId = statementIdOf(chip);
  const name = `chip-${String(chip.id)}-strength`;
  const isHard = chip.constraint.strength === ConstraintStrength.Hard;
  const options = [
    { value: ConstraintStrength.Preferred, label: 'Preferred', isChecked: !isHard },
    { value: ConstraintStrength.Hard, label: 'Required (hard)', isChecked: isHard },
  ];
  return (
    <fieldset aria-describedby={statementId}>
      <legend>How firm is this?</legend>
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

/** Props for the Dismiss and Confirm buttons. */
interface ChipDecisionProps extends ConstraintChipProps {
  readonly statement: string;
}

/**
 * The Dismiss and Confirm buttons, each named with the chip's statement.
 *
 * @param props - The chip, the handlers and the statement.
 * @returns The two buttons.
 */
function ChipDecision({ chip, actions, statement }: ChipDecisionProps): ReactElement {
  return (
    <>
      <button
        type="button"
        aria-label={`Dismiss: ${statement}`}
        onClick={() => {
          actions.dismiss(chip.id);
        }}
      >
        Dismiss
      </button>{' '}
      <button
        type="button"
        aria-label={`Confirm: ${statement}`}
        onClick={() => {
          actions.confirm(chip.id);
        }}
      >
        Confirm
      </button>
    </>
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
  const editRef = useRef<HTMLButtonElement>(null);
  // Only a chip the student acted on takes focus; one already confirmed on arrival does not.
  const [wasPending] = useState(chip.status === 'pending');
  if (chip.status !== 'pending') {
    const outcome =
      chip.status === 'confirmed' ? 'added to the form.' : 'dismissed, nothing changed.';
    return <ChipOutcome text={`${statement} (${strength}) — ${outcome}`} isFocused={wasPending} />;
  }
  return (
    <li className="chip">
      <p className="chip__statement" id={statementIdOf(chip)}>
        {statement}
      </p>
      <StrengthChoice chip={chip} actions={actions} />
      {chip.isEditing ? (
        <ChipEditor
          chip={chip}
          actions={actions}
          onSaved={() => {
            editRef.current?.focus();
          }}
        />
      ) : null}
      {chip.problem === null ? null : (
        <p role="alert" className="notice notice--caution">
          {chip.problem}
        </p>
      )}
      <p className="chip__actions">
        <button
          type="button"
          ref={editRef}
          aria-label={`Edit: ${statement}`}
          aria-expanded={chip.isEditing}
          onClick={() => {
            actions.setEditing(chip.id, !chip.isEditing);
          }}
        >
          Edit
        </button>{' '}
        <ChipDecision chip={chip} actions={actions} statement={statement} />
      </p>
    </li>
  );
}
