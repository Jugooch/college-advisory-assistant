/**
 * @file The confirmation after a case is opened. It sits outside the live region and takes focus,
 * so a screen reader reads it once. It says where the case stands, never that anything was approved.
 * @module @caa/web/features/advisor-cases/components/case-created-confirmation
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import Link from 'next/link';
import type { ReactElement, Ref } from 'react';

import { Timestamp } from '@/shared/components/timestamp';

import { describeCaseStatus } from '../utils/case-wording';
import type { CreateCaseState } from '../utils/create-case-state';

/** Props for {@link CaseCreatedConfirmation}. */
export interface CaseCreatedConfirmationProps {
  readonly state: Extract<CreateCaseState, { readonly kind: 'created' }>;
  /** Link to the student's Help and cases page. */
  readonly casesHref: string;
  /** Focus target, so keyboard and screen reader users land on the confirmation. */
  readonly confirmationRef: Ref<HTMLDivElement>;
}

/**
 * Renders the new case's status, what happens next, and a link to Help and cases.
 *
 * @param props - The created state, the link, and the focus ref.
 * @returns The confirmation.
 */
export function CaseCreatedConfirmation({
  state,
  casesHref,
  confirmationRef,
}: CaseCreatedConfirmationProps): ReactElement {
  const status = describeCaseStatus(state.status);
  return (
    <div className="notice" tabIndex={-1} ref={confirmationRef}>
      <p>
        <strong>Case opened.</strong> {status.label}. Opened <Timestamp iso={state.createdAt} />.
      </p>
      <p>{status.explanation}</p>
      <p>{status.nextStep}</p>
      <p>
        <Link href={casesHref}>Open Help and cases</Link>
      </p>
    </div>
  );
}
