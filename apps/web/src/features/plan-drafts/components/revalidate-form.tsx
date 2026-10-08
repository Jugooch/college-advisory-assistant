'use client';
/**
 * @file The Revalidate control for a plan's latest revision. It submits the revision the student
 * is looking at through a server action and reports the result in one polite status region.
 * Focus never moves: the page reloads the latest revision and the message stays in place.
 * @module @caa/web/features/plan-drafts/components/revalidate-form
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { useRouter } from 'next/navigation';
import { type ReactElement, useActionState, useEffect } from 'react';

import {
  REVALIDATE_PLAN_FIELD,
  REVALIDATE_REVISION_FIELD,
  REVALIDATE_SELECTION_FIELD,
  REVALIDATE_STUDENT_FIELD,
} from '../utils/revalidate-form';
import { IDLE_REVALIDATE_STATE, type RevalidateState } from '../utils/revalidate-state';
import { RevalidateResult } from './revalidate-result';

/** Props for {@link RevalidateForm}. */
export interface RevalidateFormProps {
  /** Server action that revalidates; the page passes it in (standard 06). */
  readonly revalidateAction: (
    previous: RevalidateState,
    formData: FormData,
  ) => Promise<RevalidateState>;
  readonly studentId: string;
  readonly planId: string;
  /** The latest revision number the page shows; sent so a newer one is a conflict. */
  readonly revision: number;
  /** Whether that revision has a chosen option, so the result can say what became of it. */
  readonly hasSelection: boolean;
}

/**
 * Renders the Revalidate button and the status region that reports its result.
 *
 * @param props - The action, the plan, and the revision being shown.
 * @returns The form.
 */
export function RevalidateForm({
  revalidateAction,
  studentId,
  planId,
  revision,
  hasSelection,
}: RevalidateFormProps): ReactElement {
  const [state, formAction, isPending] = useActionState(revalidateAction, IDLE_REVALIDATE_STATE);
  const router = useRouter();
  useEffect(() => {
    if (state.kind === 'revalidated' || state.kind === 'conflict') {
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={formAction} aria-describedby="revalidate-note">
      <input type="hidden" name={REVALIDATE_STUDENT_FIELD} value={studentId} />
      <input type="hidden" name={REVALIDATE_PLAN_FIELD} value={planId} />
      <input type="hidden" name={REVALIDATE_REVISION_FIELD} value={revision} />
      <input type="hidden" name={REVALIDATE_SELECTION_FIELD} value={String(hasSelection)} />
      <button
        type="submit"
        aria-disabled={isPending}
        onClick={(event) => {
          if (isPending) {
            event.preventDefault();
          }
        }}
      >
        Revalidate
      </button>
      <p id="revalidate-note">
        Revalidating checks this draft against your latest records and adds a new revision. It never
        replaces an earlier one, and it doesn’t register you for anything.
      </p>
      <div role="status">
        {state.kind === 'idle' ? null : <RevalidateResult state={state} />}
        {isPending ? <p>Revalidating…</p> : null}
      </div>
    </form>
  );
}
