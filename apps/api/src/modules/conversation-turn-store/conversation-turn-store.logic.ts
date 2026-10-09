/**
 * @file Pure rules of a turn's stored side: the rate-limit window, the retention bounds, and the
 * stale-sequence check.
 * @module @caa/api/modules/conversation-turn-store/conversation-turn-store.logic
 * @requirement FR-02
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC45
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 2 and 7)
 */

/** Student turns are counted over this rolling window (ADR-0015 section 1). */
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/** Stored turns older than this are deleted on each append (ADR-0015 section 7). */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Only this many newest turns are kept (ADR-0015 section 7). */
export const RETENTION_COUNT = 100;

/**
 * Tells whether the caller saw the conversation's last sequence. The last sequence survives a
 * clear and retention, so this is decided the same way for a new, cleared or full conversation.
 *
 * @param lastSequence - The conversation's stored last sequence.
 * @param expectedSequence - The sequence the caller saw.
 * @returns `true` only when they match.
 */
export function isSequenceCurrent(lastSequence: number, expectedSequence: number): boolean {
  return lastSequence === expectedSequence;
}
