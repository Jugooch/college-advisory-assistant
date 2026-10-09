/**
 * @file The labelled message box and Send button. Enter in the box submits.
 * @module @caa/web/features/conversation/components/chat-message-form
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement, RefObject, SubmitEvent } from 'react';

import { STUDENT_TURN_MAX_LENGTH } from '@caa/domain';

/** Props for {@link ChatMessageForm}. */
export interface ChatMessageFormProps {
  readonly message: string;
  readonly onMessageChange: (message: string) => void;
  readonly onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  readonly isPending: boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
}

/**
 * Renders the form. While a turn is pending the form is marked busy and Send ignores presses,
 * but stays focusable.
 *
 * @param props - The message, its handlers, the pending flag and the input ref.
 * @returns The form.
 */
export function ChatMessageForm({
  message,
  onMessageChange,
  onSubmit,
  isPending,
  inputRef,
}: ChatMessageFormProps): ReactElement {
  return (
    <form onSubmit={onSubmit} aria-busy={isPending}>
      <label htmlFor="chat-message">Message to the assistant</label>
      <input
        id="chat-message"
        ref={inputRef}
        type="text"
        value={message}
        maxLength={STUDENT_TURN_MAX_LENGTH}
        autoComplete="off"
        onChange={(event) => {
          onMessageChange(event.target.value);
        }}
      />
      <button type="submit" aria-disabled={isPending}>
        {isPending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
