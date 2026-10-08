'use client';
/**
 * @file Client state for a create-case form: the action state, the pending flag, and focus on the
 * confirmation once the case is opened.
 * @module @caa/web/features/advisor-cases/hooks/use-create-case
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/standards/06-frontend.md
 */
import { type ActionDispatch, type RefObject, useActionState, useEffect, useRef } from 'react';

import { type CreateCaseState, IDLE_CREATE_CASE_STATE } from '../utils/create-case-state';

/** What {@link useCreateCase} returns. */
export interface CreateCaseControls {
  readonly state: CreateCaseState;
  /** Pass as the form's `action`. */
  readonly formAction: ActionDispatch<[payload: FormData]>;
  readonly isPending: boolean;
  /** Attach to the confirmation, which takes focus when the case is opened. */
  readonly confirmationRef: RefObject<HTMLDivElement | null>;
}

/**
 * Runs the create-case action and moves focus to the confirmation on success. Focus never moves
 * into the live region, so a screen reader reads the confirmation once.
 *
 * @param action - The server action that opens the case.
 * @returns The state, the form action, the pending flag, and the confirmation ref.
 */
export function useCreateCase(
  action: (previous: CreateCaseState, formData: FormData) => Promise<CreateCaseState>,
): CreateCaseControls {
  const [state, formAction, isPending] = useActionState(action, IDLE_CREATE_CASE_STATE);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.kind === 'created') {
      confirmationRef.current?.focus();
    }
  }, [state]);
  return { state, formAction, isPending, confirmationRef };
}
