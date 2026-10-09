/**
 * @file Recovers from a sequence conflict: reloads the transcript and says so.
 * @module @caa/web/features/conversation/hooks/use-chat-reload
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { type ChatProblem, problemFrom, type ReloadResult } from '../utils/conversation-state';
import { CONFLICT_ANNOUNCEMENT } from '../utils/conversation-wording';
import type { ChatTranscript } from './use-chat-transcript';

/** What {@link useChatReload} needs. */
export interface ChatReloadInput {
  readonly studentId: string;
  readonly termId: string;
  readonly reloadAction: (studentId: string, termId: string) => Promise<ReloadResult>;
  readonly transcript: ChatTranscript;
  readonly setProblem: (problem: ChatProblem | null) => void;
  readonly finish: (text: string) => void;
}

/**
 * Builds the reload step: swap in the server's transcript, or show why that failed.
 *
 * @param input - The student, term, action, transcript and feedback handlers.
 * @returns A function that reloads the transcript.
 */
export function useChatReload(input: ChatReloadInput): () => Promise<void> {
  const { studentId, termId, reloadAction, transcript, setProblem, finish } = input;
  return async () => {
    const reloaded = await reloadAction(studentId, termId);
    if (reloaded.kind === 'loaded') {
      transcript.reload(reloaded.conversation);
      finish(CONFLICT_ANNOUNCEMENT);
    } else {
      setProblem(problemFrom(reloaded));
      finish('');
    }
  };
}
