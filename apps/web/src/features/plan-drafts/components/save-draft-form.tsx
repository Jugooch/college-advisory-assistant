'use client';
/**
 * @file The save-as-draft control for one option, or for a result with no options. It submits the
 * original request, the option's section IDs, and the pinned inputs through a server action, and
 * announces the result in a polite live region.
 * @module @caa/web/features/plan-drafts/components/save-draft-form
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { useRouter } from 'next/navigation';
import { type ReactElement, useActionState, useEffect, useRef } from 'react';

import type { SavePlanRequest } from '@caa/api-contract';

import { DRAFT_FIELD, encodeSaveDraft, STUDENT_FIELD } from '../utils/save-draft-form';
import { IDLE_SAVE_DRAFT_STATE, type SaveDraftState } from '../utils/save-draft-state';
import { SaveDraftResult } from './save-draft-result';

/** Props for {@link SaveDraftForm}. */
export interface SaveDraftFormProps {
  /** Server action that saves the draft. */
  readonly saveAction: (previous: SaveDraftState, formData: FormData) => Promise<SaveDraftState>;
  readonly studentId: string;
  /** What to send: the original request, the option's sections or `null`, the pinned inputs. */
  readonly draft: SavePlanRequest;
  /** Button text: "Save as draft" for an option, "Save this result" when there are no options. */
  readonly label: string;
  /** Distinguishes several forms on one page. */
  readonly idPrefix: string;
  /** Link to the student's My plans page. */
  readonly plansHref: string;
}

/**
 * Renders the save button and the live region that reports its result.
 *
 * @param props - The action, the student, the draft to send, and the button text.
 * @returns The form.
 */
export function SaveDraftForm({
  saveAction,
  studentId,
  draft,
  label,
  idPrefix,
  plansHref,
}: SaveDraftFormProps): ReactElement {
  const [state, formAction, isPending] = useActionState(saveAction, IDLE_SAVE_DRAFT_STATE);
  const router = useRouter();
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.kind === 'saved') {
      confirmationRef.current?.focus();
    }
  }, [state]);
  return (
    <form action={formAction} aria-describedby={`${idPrefix}-note`}>
      <input type="hidden" name={STUDENT_FIELD} value={studentId} />
      <input type="hidden" name={DRAFT_FIELD} value={encodeSaveDraft(draft)} />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : label}
      </button>
      <p id={`${idPrefix}-note`}>A draft is a saved plan. It doesn’t register you for anything.</p>
      <div id={`${idPrefix}-result`} role="status" aria-live="polite">
        {state.kind === 'idle' ? null : (
          <SaveDraftResult
            state={state}
            plansHref={plansHref}
            confirmationRef={confirmationRef}
            onRefresh={() => {
              router.refresh();
            }}
          />
        )}
      </div>
    </form>
  );
}
