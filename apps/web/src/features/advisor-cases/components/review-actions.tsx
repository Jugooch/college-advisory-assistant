'use client';
/**
 * @file The reviewer's actions on one case: Claim, Release, and Resolve. Each is offered only
 * when the case view's `allowedActions` lists it; this component never works out the transition
 * table. Pending, rejected, and failed results are reported in one polite live region.
 * @module @caa/web/features/advisor-cases/components/review-actions
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import { CaseAction } from '@caa/domain';

import { describeError } from '@/shared/utils/error-code-wording';

import {
  isShowingStaleCase,
  type ReviewAction,
  type ReviewCaseState,
} from '../utils/review-case-state';
import { NO_ACTIONS_AVAILABLE, REVIEW_FORM_REJECTED } from '../utils/review-wording';
import { ResolveForm } from './resolve-form';
import { ReviewButton } from './review-button';
import { ReviewHiddenFields } from './review-hidden-fields';

/** Props for {@link ReviewActions}. */
export interface ReviewActionsProps {
  readonly caseId: string;
  /** The case view's `lastSequence`, sent back so a race gets a conflict instead of a guess. */
  readonly lastSequence: number;
  /** The actions the API says this session may take now. */
  readonly allowedActions: readonly CaseAction[];
  readonly state: ReviewCaseState;
  readonly isPending: boolean;
  /** The form action from the review panel's `useActionState`. */
  readonly formAction: (formData: FormData) => void;
}

/** The button text for the actions that need no more input. */
const SIMPLE_ACTIONS: readonly { readonly action: ReviewAction; readonly label: string }[] = [
  { action: CaseAction.Claim, label: 'Claim this case' },
  { action: CaseAction.Release, label: 'Release this case to the queue' },
];

/**
 * Explains a failed action with its next step and support reference.
 *
 * @param props - The failed state.
 * @param props.state - The failure to explain.
 * @returns The notice.
 */
function FailedNotice({
  state,
}: {
  readonly state: Extract<ReviewCaseState, { kind: 'failed' }>;
}): ReactElement {
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

/**
 * Renders the offered actions and the live region.
 *
 * @param props - The case, the sequence, the allowed actions, the state, and the form action.
 * @returns The actions section.
 */
export function ReviewActions({
  caseId,
  lastSequence,
  allowedActions,
  state,
  isPending,
  formAction,
}: ReviewActionsProps): ReactElement {
  const isStale = isShowingStaleCase(state, lastSequence);
  const simple = SIMPLE_ACTIONS.filter(({ action }) => allowedActions.includes(action));
  const canResolve = allowedActions.includes(CaseAction.Resolve);
  const hasNone = simple.length === 0 && !canResolve;
  return (
    <section aria-labelledby="review-actions-heading">
      <h2 id="review-actions-heading">Your review</h2>
      {isStale ? null : (
        <>
          {hasNone ? <p>{NO_ACTIONS_AVAILABLE}</p> : null}
          {simple.map(({ action, label }) => (
            <form key={action} action={formAction}>
              <ReviewHiddenFields caseId={caseId} lastSequence={lastSequence} action={action} />
              <ReviewButton label={label} isPending={isPending} />
            </form>
          ))}
          {canResolve ? (
            <ResolveForm
              formAction={formAction}
              isPending={isPending}
              caseId={caseId}
              lastSequence={lastSequence}
            />
          ) : null}
        </>
      )}
      <div role="status" aria-live="polite" aria-label="Review result">
        {isPending ? <p>Saving…</p> : null}
        {state.kind === 'rejected' ? (
          <div className="notice notice--problem">
            <p>{REVIEW_FORM_REJECTED}</p>
          </div>
        ) : null}
        {state.kind === 'failed' ? <FailedNotice state={state} /> : null}
      </div>
    </section>
  );
}
