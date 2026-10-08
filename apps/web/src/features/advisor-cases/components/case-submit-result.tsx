/**
 * @file What a failed create-case attempt produced: the open-case-exists message, the
 * rejected-form message, or the API's own error. It sits inside the form's polite live region.
 * @module @caa/web/features/advisor-cases/components/case-submit-result
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import { describeError } from '@/shared/utils/error-code-wording';

import { FORM_REJECTED, OPEN_CASE_EXISTS } from '../utils/case-wording';
import type { CreateCaseState } from '../utils/create-case-state';

/** Props for {@link CaseSubmitResult}. */
export interface CaseSubmitResultProps {
  readonly state: Exclude<CreateCaseState, { readonly kind: 'idle' | 'created' }>;
  /** Link to the student's Help and cases page, where the open case is. */
  readonly casesHref: string;
}

/**
 * Renders one failed outcome with what happened and what to do next.
 *
 * @param props - The state and the Help and cases link.
 * @returns The outcome section.
 */
export function CaseSubmitResult({ state, casesHref }: CaseSubmitResultProps): ReactElement {
  if (state.kind === 'duplicate') {
    return (
      <div className="notice notice--caution">
        <p>
          <strong>{OPEN_CASE_EXISTS}</strong> Nothing new was sent.
        </p>
        <p>
          <Link href={casesHref}>See your open case</Link> to check where it stands.
        </p>
      </div>
    );
  }
  if (state.kind === 'rejected') {
    return (
      <div className="notice notice--problem">
        <p>{FORM_REJECTED}</p>
      </div>
    );
  }
  const wording = describeError(state.code);
  return (
    <div className="notice notice--problem">
      <p>
        <strong>{wording.heading}.</strong> {state.message}
      </p>
      <p>{wording.nextStep}</p>
      {state.requestId === null ? null : (
        <p>
          Support reference: <code>{state.requestId}</code>
        </p>
      )}
    </div>
  );
}
