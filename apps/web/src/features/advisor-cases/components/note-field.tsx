'use client';
/**
 * @file The note field with its character limit: a visible counter linked to the field, and a
 * polite live region that speaks only when the student is close to or at the limit.
 * @module @caa/web/features/advisor-cases/components/note-field
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import { type ChangeEvent, type ReactElement, type Ref, useId } from 'react';

import { describeNoteCount, describeNoteWarning, NOTE_MAX_LENGTH } from '../utils/case-note';

/** Shown under the field when the note is empty or blank on submit. */
export const NOTE_REQUIRED_MESSAGE = `Write a note of 1 to ${String(NOTE_MAX_LENGTH)} characters.`;

/** Props for {@link NoteField}. */
export interface NoteFieldProps {
  /** The label text, for example "Your note for your advisor". */
  readonly label: string;
  /** Guidance shown above the field. */
  readonly hint: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** `true` after a submit with no usable note: shows the error and marks the field invalid. */
  readonly hasError: boolean;
  /** Lets the form move focus to the field when it rejects a submit. */
  readonly fieldRef: Ref<HTMLTextAreaElement>;
  /** The limit in characters. Defaults to the student's note limit. */
  readonly maxLength?: number;
  /** The form field name, when the note is submitted as a native form field. */
  readonly name?: string;
}

/**
 * Renders the labelled textarea, its counter, and its error.
 *
 * @param props - The label, hint, value, change handler, error flag, focus ref, and optional
 *   limit and field name.
 * @returns The field group.
 */
export function NoteField({
  label,
  hint,
  value,
  onChange,
  hasError,
  fieldRef,
  maxLength = NOTE_MAX_LENGTH,
  name,
}: NoteFieldProps): ReactElement {
  const id = useId();
  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  const errorId = `${id}-error`;
  const describedBy = [hintId, countId, hasError ? errorId : null].filter(Boolean).join(' ');
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <p id={hintId}>{hint}</p>
      <textarea
        id={id}
        ref={fieldRef}
        rows={5}
        name={name}
        maxLength={maxLength}
        value={value}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange(event.target.value);
        }}
      />
      <p id={countId}>{describeNoteCount(value, maxLength)}</p>
      <p role="status" aria-live="polite" aria-label="Note length">
        {describeNoteWarning(value, maxLength)}
      </p>
      {hasError ? (
        <p id={errorId} className="field-error">
          {NOTE_REQUIRED_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}
