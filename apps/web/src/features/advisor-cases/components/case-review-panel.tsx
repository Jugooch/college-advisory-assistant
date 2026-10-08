'use client';
/**
 * @file The review screen's frame for one case. The case title is a persistent heading that takes
 * focus after an action removes the control that had it, and that points at the outcome message.
 * If the case is no longer available (404), the case content is removed from view. Actions come
 * only from the API's `allowedActions`.
 * @module @caa/web/features/advisor-cases/components/case-review-panel
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { type ReactElement, type ReactNode, useActionState, useEffect, useId, useRef } from 'react';

import type { CaseAction } from '@caa/domain';

import { hasOutcome, IDLE_REVIEW_STATE, type ReviewCaseState } from '../utils/review-case-state';
import { NO_ACCESS_HEADING } from '../utils/review-wording';
import { ReviewActions } from './review-actions';
import { ReviewOutcome } from './review-outcome';

/** Props for {@link CaseReviewPanel}. */
export interface CaseReviewPanelProps {
  /** Heading text: the case's reason, never a user ID. */
  readonly title: string;
  readonly caseId: string;
  /** The case view's `lastSequence`. */
  readonly lastSequence: number;
  /** The actions the API says this session may take now. */
  readonly allowedActions: readonly CaseAction[];
  /** Server action that sends the event. */
  readonly reviewAction: (
    previous: ReviewCaseState,
    formData: FormData,
  ) => Promise<ReviewCaseState>;
  /** The case's details, rendered on the server and removed from view if access is lost. */
  readonly children: ReactNode;
}

/**
 * Renders the heading, the outcome, the case details, and the actions.
 *
 * @param props - The title, the case, the allowed actions, the server action, and the details.
 * @returns The case article.
 */
export function CaseReviewPanel({
  title,
  caseId,
  lastSequence,
  allowedActions,
  reviewAction,
  children,
}: CaseReviewPanelProps): ReactElement {
  const [state, formAction, isPending] = useActionState(reviewAction, IDLE_REVIEW_STATE);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const headingId = `${id}-heading`;
  const outcomeId = `${id}-outcome`;
  useEffect(() => {
    // NOTE: these outcomes can remove the control that had focus, which would drop focus to the
    // page body. The heading is persistent and outside any live region.
    if (hasOutcome(state)) {
      headingRef.current?.focus();
    }
  }, [state]);
  const isGone = state.kind === 'gone';
  return (
    <article aria-labelledby={headingId}>
      <h1
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        aria-describedby={hasOutcome(state) ? outcomeId : undefined}
      >
        {isGone ? NO_ACCESS_HEADING : title}
      </h1>
      <ReviewOutcome id={outcomeId} state={state} />
      {isGone ? null : (
        <>
          {children}
          <ReviewActions
            caseId={caseId}
            lastSequence={lastSequence}
            allowedActions={allowedActions}
            state={state}
            isPending={isPending}
            formAction={formAction}
          />
        </>
      )}
    </article>
  );
}
