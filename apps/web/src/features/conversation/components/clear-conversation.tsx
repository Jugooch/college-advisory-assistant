'use client';
/**
 * @file "Clear conversation" with a confirmation step. Clearing removes only the transcript.
 * @module @caa/web/features/conversation/components/clear-conversation
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { type ClearConfirmationInput, useClearConfirmation } from '../hooks/use-clear-confirmation';

/** Props for {@link ClearConversation}. */
export interface ClearConversationProps extends ClearConfirmationInput {
  /** True when there is nothing to clear, or a message is still sending. */
  readonly isDisabled: boolean;
}

/**
 * Renders the control, or the question with its two answers.
 *
 * @param props - The student, term, action, callbacks and whether there is anything to clear.
 * @returns The control.
 */
export function ClearConversation({ isDisabled, ...input }: ClearConversationProps): ReactElement {
  const clear = useClearConfirmation(input);
  if (!clear.isAsking) {
    return (
      <button
        ref={clear.startRef}
        type="button"
        aria-disabled={isDisabled}
        onClick={() => {
          if (!isDisabled) {
            clear.ask();
          }
        }}
      >
        Clear conversation
      </button>
    );
  }
  return (
    <div role="group" aria-labelledby="chat-clear-question" className="chat-clear">
      <p id="chat-clear-question">
        Clear this conversation? Your messages and the assistant’s replies are removed. Your plans
        and cases aren’t affected.
      </p>
      <button
        ref={clear.confirmRef}
        type="button"
        aria-disabled={clear.isPending}
        onClick={clear.confirm}
      >
        Yes, clear it
      </button>{' '}
      <button type="button" onClick={clear.keep}>
        Keep it
      </button>
    </div>
  );
}
