'use client';
/**
 * @file The "Ask an advisor" form for one saved plan revision: a reason, a note with a live count,
 * and a preview of exactly what will be shared. The preview renders the same request the form sends.
 * @module @caa/web/features/advisor-cases/components/ask-advisor-form
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import { type ReactElement, useState } from 'react';

import type { PlanRevisionView } from '@caa/api-contract';
import { CaseReason } from '@caa/domain';

import { Timestamp } from '@/shared/components/timestamp';
import { indexCourses } from '@/shared/utils/course-display';

import { buildPlanCaseRequest } from '../utils/case-request';
import { CHAT_NOT_SHARED, describeCaseReason, WHO_SEES_THIS } from '../utils/case-wording';
import type { CreateCaseState } from '../utils/create-case-state';
import { listSharedChecks } from '../utils/shared-checks';
import { CaseFormShell } from './case-form-shell';
import { NotePreview } from './note-preview';
import { SharedChecksList } from './shared-checks-list';

/** The two reasons a plan can be sent for review. */
const PLAN_REASONS = [CaseReason.PlanReview, CaseReason.NeedsVerification] as const;

/** Props for {@link AskAdvisorForm}. */
export interface AskAdvisorFormProps {
  /** Server action that opens the case. */
  readonly createAction: (
    previous: CreateCaseState,
    formData: FormData,
  ) => Promise<CreateCaseState>;
  readonly studentId: string;
  /** The revision the case will freeze, exactly as the API returned it. */
  readonly revision: PlanRevisionView;
  /** Link to the student's Help and cases page. */
  readonly casesHref: string;
}

/**
 * Renders the form, its preview, and the live region that reports a failed attempt.
 *
 * @param props - The action, the student, the revision, and the Help and cases link.
 * @returns The form.
 */
export function AskAdvisorForm({
  createAction,
  studentId,
  revision,
  casesHref,
}: AskAdvisorFormProps): ReactElement {
  const [reason, setReason] = useState<(typeof PLAN_REASONS)[number]>(CaseReason.PlanReview);
  const courses = indexCourses(revision.result?.courses);
  return (
    <CaseFormShell
      createAction={createAction}
      studentId={studentId}
      casesHref={casesHref}
      submitLabel="Send to my advisor"
      noteLabel="Your note for your advisor"
      noteHint="Say what you want help with. Keep it short."
      buildRequest={(note) => buildPlanCaseRequest(reason, revision.id, note)}
      fields={
        <fieldset>
          <legend>What do you want help with?</legend>
          {PLAN_REASONS.map((option) => (
            <p key={option}>
              <label>
                <input
                  type="radio"
                  name="reason"
                  value={option}
                  checked={reason === option}
                  onChange={() => {
                    setReason(option);
                  }}
                />{' '}
                {describeCaseReason(option)}
              </label>
            </p>
          ))}
        </fieldset>
      }
      renderPreview={(request) => (
        <section aria-labelledby="ask-preview-heading">
          <h2 id="ask-preview-heading">What will be shared</h2>
          <ul>
            <li>
              Plan revision {revision.revision}, saved <Timestamp iso={revision.createdAt} />
            </li>
            <li>
              Checks that did not pass on this revision:
              <SharedChecksList checks={listSharedChecks(revision)} courses={courses} />
            </li>
            <li>
              Your note: <NotePreview note={request.studentNote} />
            </li>
          </ul>
          <p>{CHAT_NOT_SHARED}</p>
          <p>{WHO_SEES_THIS}</p>
        </section>
      )}
    />
  );
}
