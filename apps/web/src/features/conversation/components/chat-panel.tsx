'use client';
/**
 * @file The chat panel beside the planner form. It shows the transcript, sends a message, and
 * states plainly when chat is unavailable. The form beside it works fully without chat.
 * @module @caa/web/features/conversation/components/chat-panel
 * @requirement FR-10
 * @requirement NFR-02
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { ConversationResponse, ScheduleOptionsRequest } from '@caa/api-contract';

import { useChatPanel } from '../hooks/use-chat-panel';
import type { ClearResult, ReloadResult, SendTurnResult } from '../utils/conversation-state';
import { NOT_REGISTRATION_NOTE, UNAVAILABLE_MESSAGE } from '../utils/conversation-wording';
import { ChatItemView } from './chat-item-view';
import { ChatMessageForm } from './chat-message-form';
import { ClearConversation } from './clear-conversation';

/** Props for {@link ChatPanel}. */
export interface ChatPanelProps {
  readonly studentId: string;
  /** The term the planner form is for. */
  readonly termId: string;
  /** The form's confirmed inputs, or null when the student hasn't confirmed any. */
  readonly plannerInputs: ScheduleOptionsRequest | null;
  /** The transcript and availability as the API returned them. */
  readonly initial: ConversationResponse;
  /** Server action that posts a turn. */
  readonly sendAction: (studentId: string, request: unknown) => Promise<SendTurnResult>;
  /** Server action that reloads the transcript after a conflict. */
  readonly reloadAction: (studentId: string, termId: string) => Promise<ReloadResult>;
  /** Server action that clears the transcript. */
  readonly clearAction: (studentId: string, termId: string) => Promise<ClearResult>;
}

/**
 * Renders the panel.
 *
 * @param props - The student, term, form inputs, initial transcript, and the three actions.
 * @returns The panel.
 */
export function ChatPanel({ clearAction, ...input }: ChatPanelProps): ReactElement {
  const chat = useChatPanel(input);
  const { studentId, termId } = input;
  const { items, isAvailable } = chat.transcript;
  return (
    <section className="chat-panel" aria-labelledby="chat-heading">
      <h2 id="chat-heading">Ask the assistant</h2>
      <p>{NOT_REGISTRATION_NOTE}</p>
      {isAvailable ? (
        <>
          {items.length === 0 ? (
            <p>No messages yet.</p>
          ) : (
            <ol className="chat-transcript" aria-label="Conversation">
              {items.map((item) => (
                <ChatItemView key={item.key} item={item} studentId={studentId} />
              ))}
            </ol>
          )}
          <ChatMessageForm
            message={chat.message}
            onMessageChange={chat.setMessage}
            onSubmit={chat.submit}
            isPending={chat.isPending}
            inputRef={chat.inputRef}
          />
          {chat.problem === null ? null : (
            <p role="alert" className="notice notice--problem">
              {chat.problem.message}
              {chat.problem.requestId === null
                ? ''
                : ` (support reference: ${chat.problem.requestId})`}
            </p>
          )}
          <ClearConversation
            studentId={studentId}
            termId={termId}
            clearAction={clearAction}
            isDisabled={items.length === 0 || chat.isPending}
            onCleared={chat.markCleared}
            onFailed={chat.setProblem}
          />
        </>
      ) : (
        <p role="note" className="notice notice--caution">
          {UNAVAILABLE_MESSAGE}
        </p>
      )}
      <div role="status" aria-live="polite" className="chat-live">
        {chat.announcement}
      </div>
    </section>
  );
}
