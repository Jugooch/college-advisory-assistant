'use client';
/**
 * @file The form that resolves a case: a resolution code and an optional note of up to 1,000
 * characters that the student can read. It says plainly that a resolution is not an official
 * waiver or approval. It is offered only when `allowedActions` lists `RESOLVE`.
 * @module @caa/web/features/advisor-cases/components/resolve-form
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { type ReactElement, useId, useRef, useState } from 'react';

import { CASE_EVENT_NOTE_MAX_LENGTH, CaseAction, type CaseResolution } from '@caa/domain';

import { REVIEW_NOTE_FIELD } from '../utils/review-case-state';
import { RESOLVE_DISCLAIMER } from '../utils/review-wording';
import { NoteField } from './note-field';
import { ResolutionOptions } from './resolution-options';
import { ReviewButton } from './review-button';
import { ReviewHiddenFields } from './review-hidden-fields';

/** Hint above the note: who reads it. */
export const RESOLVE_NOTE_HINT =
  'Optional. The student can read this note, so keep it short and clear.';

/** Props for {@link ResolveForm}. */
export interface ResolveFormProps {
  /** The form action from the review panel's `useActionState`. */
  readonly formAction: (formData: FormData) => void;
  readonly isPending: boolean;
  readonly caseId: string;
  readonly lastSequence: number;
}

/**
 * Renders the resolve form.
 *
 * @param props - The action, the pending flag, the case, and the sequence the page showed.
 * @returns The form.
 */
export function ResolveForm({
  formAction,
  isPending,
  caseId,
  lastSequence,
}: ResolveFormProps): ReactElement {
  const [resolution, setResolution] = useState<CaseResolution | null>(null);
  const [note, setNote] = useState('');
  const [hasError, setHasError] = useState(false);
  const firstOptionRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const noticeId = `${id}-notice`;
  const errorId = `${id}-error`;
  return (
    <form
      action={formAction}
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        if (isPending) {
          event.preventDefault();
        } else if (resolution === null) {
          event.preventDefault();
          setHasError(true);
          firstOptionRef.current?.focus();
        }
      }}
    >
      <h3 id={`${id}-title`}>Resolve this case</h3>
      <ReviewHiddenFields caseId={caseId} lastSequence={lastSequence} action={CaseAction.Resolve} />
      <p id={noticeId}>{RESOLVE_DISCLAIMER}</p>
      <ResolutionOptions
        selected={resolution}
        onSelect={(option) => {
          setResolution(option);
          setHasError(false);
        }}
        describedBy={hasError ? `${noticeId} ${errorId}` : noticeId}
        errorId={hasError ? errorId : null}
        firstOptionRef={firstOptionRef}
      />
      <NoteField
        label="Note for the student"
        hint={RESOLVE_NOTE_HINT}
        value={note}
        onChange={setNote}
        hasError={false}
        fieldRef={noteRef}
        maxLength={CASE_EVENT_NOTE_MAX_LENGTH}
        name={REVIEW_NOTE_FIELD}
      />
      <ReviewButton label="Resolve this case" isPending={isPending} />
    </form>
  );
}
