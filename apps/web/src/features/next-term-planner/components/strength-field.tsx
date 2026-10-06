/**
 * @file The hard-or-preferred choice of one constraint, with the priority of a preference.
 * Preferred is the default, so nothing becomes a hard exclusion until the student chooses it and
 * confirms it on the review step.
 * @module @caa/web/features/next-term-planner/components/strength-field
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { ConstraintStrength } from '@caa/domain';

import {
  type ConstraintSlot,
  plannerFieldId,
  slotFieldName,
  type StrengthInput,
} from '../utils/planner-fields';

/** Props for {@link StrengthField}. */
export interface StrengthFieldProps {
  readonly slot: ConstraintSlot;
  /** What the constraint is called, to name the controls, such as "unavailable time 1". */
  readonly label: string;
  readonly input: StrengthInput;
  /** Why the priority was rejected, or null. */
  readonly rankError: string | null;
}

/**
 * Renders the strength radios and the priority field, each labelled in words.
 *
 * @param props - The slot, its label, the typed values, and the priority's error.
 * @returns The fieldset.
 */
export function StrengthField({ slot, label, input, rankError }: StrengthFieldProps): ReactElement {
  const strengthName = slotFieldName(slot, 'strength');
  const strengthId = plannerFieldId(strengthName);
  const rankName = slotFieldName(slot, 'rank');
  const rankId = plannerFieldId(rankName);
  const isHard = input.strength === ConstraintStrength.Hard;
  return (
    <fieldset aria-describedby={`${strengthId}-hint`}>
      <legend>How firm is {label}?</legend>
      <p id={`${strengthId}-hint`}>
        A preference is weighed but may not be met. A required constraint removes every schedule
        that breaks it.
      </p>
      <div className="choice">
        <input
          id={strengthId}
          type="radio"
          name={strengthName}
          value={ConstraintStrength.Preferred}
          defaultChecked={!isHard}
        />
        <label htmlFor={strengthId}>Preferred</label>
      </div>
      <div className="choice">
        <input
          id={`${strengthId}-hard`}
          type="radio"
          name={strengthName}
          value={ConstraintStrength.Hard}
          defaultChecked={isHard}
        />
        <label htmlFor={`${strengthId}-hard`}>Required</label>
      </div>
      <label htmlFor={rankId}>Priority for {label} if preferred (1 matters most)</label>
      <input
        id={rankId}
        name={rankName}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={input.rank}
        aria-invalid={rankError !== null}
        aria-describedby={rankError === null ? undefined : `${rankId}-error`}
      />
      {rankError === null ? null : (
        <p id={`${rankId}-error`} className="field-error">
          {rankError}
        </p>
      )}
    </fieldset>
  );
}
