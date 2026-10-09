/**
 * @file A labelled single-line text field for a chip edit, with a persistent format hint and an
 * associated error.
 * @module @caa/web/features/conversation/components/text-field
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/** Props for {@link TextField}. */
export interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** Always-visible format help, linked to the input. */
  readonly hint?: string;
  readonly inputMode?: 'numeric' | 'decimal';
  /** The id of the error message that applies to this field, or `null`. */
  readonly errorId: string | null;
  readonly onChange: (value: string) => void;
}

/**
 * A labelled single-line text field.
 *
 * @param props - The id, label, hint, value, error link and change handler.
 * @returns The label, hint and input.
 */
export function TextField(props: TextFieldProps): ReactElement {
  const hintId = `${props.id}-hint`;
  const describedBy = [props.hint === undefined ? null : hintId, props.errorId]
    .filter((id) => id !== null)
    .join(' ');
  return (
    <>
      <label htmlFor={props.id}>{props.label}</label>
      {props.hint === undefined ? null : <p id={hintId}>{props.hint}</p>}
      <input
        id={props.id}
        type="text"
        inputMode={props.inputMode}
        autoComplete="off"
        aria-invalid={props.errorId !== null}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </>
  );
}
