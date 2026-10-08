/**
 * @file The chat column beside the planner form: the panel, or a plain statement that chat can't
 * be loaded. The form never depends on this column.
 * @module @caa/web/features/conversation/components/chat-section
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import {
  ApiError,
  type ConversationResponse,
  type ScheduleOptionsRequest,
} from '@caa/api-contract';

import type { ClearResult, SendTurnResult } from '../utils/conversation-state';
import { UNAVAILABLE_MESSAGE } from '../utils/conversation-wording';
import { ChatPanel } from './chat-panel';

/** Props for {@link ChatSection}. */
export interface ChatSectionProps {
  readonly studentId: string;
  readonly termId: string;
  /** The API's answer, its error, or null when no valid term is chosen yet. */
  readonly conversation: ConversationResponse | ApiError | null;
  readonly plannerInputs: ScheduleOptionsRequest | null;
  readonly sendAction: (studentId: string, request: unknown) => Promise<SendTurnResult>;
  readonly clearAction: (studentId: string, termId: string) => Promise<ClearResult>;
}

/**
 * Renders the panel when the transcript loaded; otherwise a note, with no chat controls.
 *
 * @param props - The student, term, the loaded conversation and the actions.
 * @returns The aside.
 */
export function ChatSection({ conversation, ...panel }: ChatSectionProps): ReactElement {
  return (
    <aside aria-label="Assistant">
      {conversation === null || conversation instanceof ApiError ? (
        <p role="note" className="notice notice--caution">
          {UNAVAILABLE_MESSAGE}
          {conversation instanceof ApiError && conversation.requestId !== null
            ? ` (support reference: ${conversation.requestId})`
            : ''}
        </p>
      ) : (
        <ChatPanel {...panel} initial={conversation} />
      )}
    </aside>
  );
}
