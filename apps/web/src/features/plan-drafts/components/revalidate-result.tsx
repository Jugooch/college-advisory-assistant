/**
 * @file What a revalidate attempt produced, other than idle: the new revision, the conflict
 * message, the referral, the rejected-form message, or the API's own error. It sits inside the
 * form's status region and never takes focus.
 * @module @caa/web/features/plan-drafts/components/revalidate-result
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import { describeError } from '@/shared/utils/error-code-wording';

import {
  describeBlockedRevalidation,
  describeRevalidated,
  REVALIDATE_CONFLICT_MESSAGE,
  REVALIDATE_REJECTED_MESSAGE,
  type RevalidateState,
} from '../utils/revalidate-state';

/** Props for {@link RevalidateResult}. */
export interface RevalidateResultProps {
  readonly state: Exclude<RevalidateState, { readonly kind: 'idle' }>;
}

/**
 * Renders one revalidate outcome.
 *
 * @param props - The state.
 * @returns The outcome notice.
 */
export function RevalidateResult({ state }: RevalidateResultProps): ReactElement {
  if (state.kind === 'revalidated') {
    return (
      <div className="notice">
        <p>{describeRevalidated(state)}</p>
      </div>
    );
  }
  if (state.kind === 'conflict') {
    return (
      <div className="notice notice--caution">
        <p>{REVALIDATE_CONFLICT_MESSAGE}</p>
      </div>
    );
  }
  if (state.kind === 'blocked') {
    return (
      <div className="notice notice--caution">
        <p>{describeBlockedRevalidation(state.code)}</p>
      </div>
    );
  }
  if (state.kind === 'rejected') {
    return (
      <div className="notice notice--problem">
        <p>{REVALIDATE_REJECTED_MESSAGE}</p>
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
