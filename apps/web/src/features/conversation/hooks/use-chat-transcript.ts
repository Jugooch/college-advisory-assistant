/**
 * @file Client state for the transcript: the items shown, the latest sequence seen, and whether
 * chat is available.
 * @module @caa/web/features/conversation/hooks/use-chat-transcript
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { useRef, useState } from 'react';

import type { AssistantTurnView, ConversationResponse } from '@caa/api-contract';

import { type ChatItem, itemsFromTurns, latestSequence } from '../utils/chat-items';

/** What {@link useChatTranscript} returns. */
export interface ChatTranscript {
  readonly isAvailable: boolean;
  readonly items: readonly ChatItem[];
  /** The latest stored sequence seen: the next turn's `expectedSequence`. */
  readonly sequence: number;
  /** Appends the student's message and the reply received for it. */
  readonly addExchange: (text: string, turn: AssistantTurnView) => void;
  /** Replaces everything with a transcript freshly loaded from the API. */
  readonly reload: (conversation: ConversationResponse) => void;
  /** Empties the transcript after a clear. */
  readonly empty: () => void;
}

/**
 * Holds the transcript state.
 *
 * @param initial - The transcript and availability as the API returned them.
 * @returns The state and the ways to change it.
 */
export function useChatTranscript(initial: ConversationResponse): ChatTranscript {
  const [isAvailable, setIsAvailable] = useState(initial.available);
  const [items, setItems] = useState<readonly ChatItem[]>(() => itemsFromTurns(initial.turns));
  const [sequence, setSequence] = useState(() => latestSequence(initial.turns));
  const counter = useRef(0);
  return {
    isAvailable,
    items,
    sequence,
    addExchange: (text, turn) => {
      counter.current += 1;
      const id = String(counter.current);
      setItems((current) => [
        ...current,
        { key: `you-${id}`, kind: 'student', text },
        { key: `reply-${id}`, kind: 'live', turn },
      ]);
      if (turn.sequence !== null) {
        setSequence(turn.sequence);
      }
    },
    reload: (conversation) => {
      setIsAvailable(conversation.available);
      setItems(itemsFromTurns(conversation.turns));
      setSequence(latestSequence(conversation.turns));
    },
    empty: () => {
      setItems([]);
      setSequence(0);
    },
  };
}
