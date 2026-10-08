'use client';
/**
 * @file The parts the ask-an-advisor and report-a-problem forms share: the hidden fields, the note
 * with its limit, the preview slot, the submit control, and the confirmation. The preview and the
 * hidden field both render the one request built here, so what the student sees is what is sent.
 * @module @caa/web/features/advisor-cases/components/case-form-shell
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import { type ReactElement, type ReactNode, type SyntheticEvent, useRef, useState } from 'react';

import type { CreateCaseRequest } from '@caa/api-contract';

import { useCreateCase } from '../hooks/use-create-case';
import { isNoteSendable } from '../utils/case-note';
import {
  CASE_REQUEST_FIELD,
  CASE_STUDENT_FIELD,
  encodeCaseRequest,
} from '../utils/create-case-form';
import type { CreateCaseState } from '../utils/create-case-state';
import { CaseCreatedConfirmation } from './case-created-confirmation';
import { NoteField } from './note-field';
import { SubmitControl } from './submit-control';

/** Props for {@link CaseFormShell}. */
export interface CaseFormShellProps {
  /** Server action that opens the case. */
  readonly createAction: (
    previous: CreateCaseState,
    formData: FormData,
  ) => Promise<CreateCaseState>;
  readonly studentId: string;
  /** Link to the student's Help and cases page. */
  readonly casesHref: string;
  readonly submitLabel: string;
  readonly noteLabel: string;
  readonly noteHint: string;
  /** The form's own choices, shown above the note. */
  readonly fields: ReactNode;
  /** Builds the request from the note, the one value the preview and the form share. */
  readonly buildRequest: (note: string) => CreateCaseRequest;
  /** Renders the "what will be shared" preview for that request. */
  readonly renderPreview: (request: CreateCaseRequest) => ReactNode;
}

/**
 * Renders the form around the caller's choices and preview.
 *
 * @param props - The action, the student, the labels, the fields, and the request builders.
 * @returns The form and, once the case is opened, the confirmation.
 */
export function CaseFormShell({
  createAction,
  studentId,
  casesHref,
  submitLabel,
  noteLabel,
  noteHint,
  fields,
  buildRequest,
  renderPreview,
}: CaseFormShellProps): ReactElement {
  const { state, formAction, isPending, confirmationRef } = useCreateCase(createAction);
  const [note, setNote] = useState('');
  const [hasNoteError, setHasNoteError] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const request = buildRequest(note);
  const guardSubmit = (event: SyntheticEvent): void => {
    if (isPending) {
      event.preventDefault();
    } else if (!isNoteSendable(note)) {
      event.preventDefault();
      setHasNoteError(true);
      noteRef.current?.focus();
    }
  };
  return (
    <>
      <form action={formAction} onSubmit={guardSubmit}>
        <input type="hidden" name={CASE_STUDENT_FIELD} value={studentId} />
        <input type="hidden" name={CASE_REQUEST_FIELD} value={encodeCaseRequest(request)} />
        {fields}
        <NoteField
          label={noteLabel}
          hint={noteHint}
          value={note}
          onChange={(value) => {
            setNote(value);
            setHasNoteError(false);
          }}
          hasError={hasNoteError}
          fieldRef={noteRef}
        />
        {renderPreview(request)}
        <SubmitControl
          label={submitLabel}
          isPending={isPending}
          state={state}
          casesHref={casesHref}
        />
      </form>
      {state.kind === 'created' ? (
        <CaseCreatedConfirmation
          state={state}
          casesHref={casesHref}
          confirmationRef={confirmationRef}
        />
      ) : null}
    </>
  );
}
