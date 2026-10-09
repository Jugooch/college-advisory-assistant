'use client';
/**
 * @file The "Report a problem with my record" form: what is wrong, a note with a live count, and
 * a preview of exactly what will be shared. It says the report changes no official record.
 * @module @caa/web/features/advisor-cases/components/report-problem-form
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import { type ReactElement, useState } from 'react';

import { DiscrepancySubject } from '@caa/domain';

import {
  describeSubject,
  REPORT_CHANGES_NOTHING,
  WHO_SEES_THIS,
} from '@/shared/utils/case-wording';

import { buildDiscrepancyRequest } from '../utils/case-request';
import type { CreateCaseState } from '../utils/create-case-state';
import { CaseFormShell } from './case-form-shell';
import { NotePreview } from './note-preview';

/** Props for {@link ReportProblemForm}. */
export interface ReportProblemFormProps {
  /** Server action that opens the case. */
  readonly createAction: (
    previous: CreateCaseState,
    formData: FormData,
  ) => Promise<CreateCaseState>;
  readonly studentId: string;
  /** The subject to preselect; the student can change it. */
  readonly initialSubject?: DiscrepancySubject;
  /** Link to the student's Help and cases page. */
  readonly casesHref: string;
}

/**
 * Renders the form, its preview, and the live region that reports a failed attempt.
 *
 * @param props - The action, the student, and the Help and cases link.
 * @returns The form.
 */
export function ReportProblemForm({
  createAction,
  studentId,
  initialSubject = DiscrepancySubject.ProgramOrCatalog,
  casesHref,
}: ReportProblemFormProps): ReactElement {
  const [subject, setSubject] = useState<DiscrepancySubject>(initialSubject);
  return (
    <CaseFormShell
      createAction={createAction}
      studentId={studentId}
      casesHref={casesHref}
      submitLabel="Send report"
      noteLabel="What is wrong, and what do you expect to see?"
      noteHint="Describe the problem in your own words. Keep it short."
      buildRequest={(note) => buildDiscrepancyRequest(subject, note)}
      fields={
        <fieldset>
          <legend>What looks wrong?</legend>
          {Object.values(DiscrepancySubject).map((option) => (
            <p key={option}>
              <label>
                <input
                  type="radio"
                  name="subject"
                  value={option}
                  checked={subject === option}
                  onChange={() => {
                    setSubject(option);
                  }}
                />{' '}
                {describeSubject(option)}
              </label>
            </p>
          ))}
        </fieldset>
      }
      renderPreview={(request) => (
        <section aria-labelledby="report-preview-heading">
          <h2 id="report-preview-heading">What will be shared</h2>
          <ul>
            <li>What looks wrong: {describeSubject(subject)}</li>
            <li>
              Your note: <NotePreview note={request.studentNote} />
            </li>
          </ul>
          <p>{WHO_SEES_THIS}</p>
          <p>{REPORT_CHANGES_NOTHING}</p>
        </section>
      )}
    />
  );
}
