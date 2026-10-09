/**
 * @file Pure mapping from stored conversation turns to the transcript the student reads. A
 * stored block reference that no longer parses becomes an unavailable notice, never a guess.
 * @module @caa/api/modules/conversation-store/conversation-store.logic
 * @requirement FR-01
 * @requirement FR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 7)
 */
import type { ConversationTurnView } from '@caa/api-contract';
import type { StoredConversationTurn } from '@caa/db';
import {
  AssistantBlockKind,
  type AssistantBlockRef,
  AssistantBlockRefSchema,
  MAX_TURN_BLOCKS,
  ModelStatus,
  NoticeCode,
  StoredModelStatusSchema,
  TurnRole,
} from '@caa/domain';

/** Template of the notice that stands in for a block that can no longer be shown. */
export const UNAVAILABLE_BLOCK_TEMPLATE_ID = 'transcript-block-unavailable';

/** Version of {@link UNAVAILABLE_BLOCK_TEMPLATE_ID}. */
export const UNAVAILABLE_BLOCK_TEMPLATE_VERSION = '1';

const UNAVAILABLE_BLOCK: AssistantBlockRef = {
  kind: AssistantBlockKind.Notice,
  code: NoticeCode.ToolFailed,
  templateId: UNAVAILABLE_BLOCK_TEMPLATE_ID,
  templateVersion: UNAVAILABLE_BLOCK_TEMPLATE_VERSION,
};

/** One re-rendered template block with the reference it belongs to. */
type TemplateBlockEntry = NonNullable<
  Extract<ConversationTurnView, { role: typeof TurnRole.Assistant }>['templateBlocks']
>[number];

/** Re-renders a stored referral or notice reference, or returns null when it can't be shown. */
export type TemplateBlockRenderer = (
  ref: Extract<
    AssistantBlockRef,
    { kind: typeof AssistantBlockKind.Referral | typeof AssistantBlockKind.Notice }
  >,
  asOf: string,
) => TemplateBlockEntry['block'] | null;

/** The transcript turns and which stored turns held something unreadable. */
export interface TranscriptTurns {
  readonly turns: readonly ConversationTurnView[];
  /** Sequence numbers of the assistant turns with an unreadable status or block reference. */
  readonly unreadableSequences: readonly number[];
}

/**
 * Parses a stored block reference list. A past result keeps only its kind and `shownAt`, so it
 * can never read as a current result (ADR-0013 section 3).
 *
 * @param stored - The stored value, untrusted.
 * @returns The parsed references and whether any was replaced by an unavailable notice.
 */
function parseBlockRefs(stored: unknown): {
  readonly refs: readonly AssistantBlockRef[];
  readonly hasUnreadable: boolean;
} {
  if (!Array.isArray(stored)) {
    return { refs: [UNAVAILABLE_BLOCK], hasUnreadable: true };
  }
  const items: readonly unknown[] = stored.slice(0, MAX_TURN_BLOCKS);
  const parsed = items.map((item) => AssistantBlockRefSchema.safeParse(item));
  const kept = parsed.map((result) => (result.success ? result.data : UNAVAILABLE_BLOCK));
  const isOverLimit = stored.length > MAX_TURN_BLOCKS;
  return {
    // The last kept slot becomes the notice, so dropped references are never silent.
    refs: isOverLimit ? [...kept.slice(0, MAX_TURN_BLOCKS - 1), UNAVAILABLE_BLOCK] : kept,
    hasUnreadable: isOverLimit || parsed.some((result) => !result.success),
  };
}

/**
 * Re-renders the referral and notice references of one turn from their templates. An academic
 * reference never gets an entry, and neither does a reference whose template is unknown or an
 * older version: the web shows those as unavailable (ADR-0015 Amendment 3).
 *
 * @param refs - The turn's parsed block references.
 * @param asOf - The stored turn's creation time, recorded on each referral (never the clock).
 * @param render - Re-renders one template reference (the mapper, so this file stays pure).
 * @returns The entries, in reference order.
 */
function renderTemplateBlocks(
  refs: readonly AssistantBlockRef[],
  asOf: string,
  render: TemplateBlockRenderer,
): readonly TemplateBlockEntry[] {
  return refs.flatMap((ref, refIndex): readonly TemplateBlockEntry[] => {
    // SAFETY: only fixed-wording kinds are re-rendered; schedule, plan, policy, constraint and
    // case references keep their "shown at" rendering so a stored PASS is never current.
    if (ref.kind !== AssistantBlockKind.Referral && ref.kind !== AssistantBlockKind.Notice) {
      return [];
    }
    const block = render(ref, asOf);
    return block === null ? [] : [{ refIndex, block }];
  });
}

/**
 * Maps stored turns, oldest first, to transcript turns.
 *
 * @param stored - Stored turns in increasing sequence order.
 * @param render - Re-renders a stored referral or notice reference.
 * @returns The transcript turns and the sequences that held unreadable data.
 */
export function toTranscriptTurns(
  stored: readonly StoredConversationTurn[],
  render: TemplateBlockRenderer,
): TranscriptTurns {
  const unreadableSequences: number[] = [];
  const turns = stored.map((turn): ConversationTurnView => {
    if (turn.role === TurnRole.Student) {
      return {
        sequence: turn.sequence,
        createdAt: turn.createdAt,
        role: TurnRole.Student,
        text: turn.text,
      };
    }
    const status = StoredModelStatusSchema.safeParse(turn.modelStatus);
    const { refs, hasUnreadable } = parseBlockRefs(turn.blockRefs);
    if (!status.success || hasUnreadable) {
      unreadableSequences.push(turn.sequence);
    }
    const templateBlocks = renderTemplateBlocks(refs, turn.createdAt, render);
    return {
      sequence: turn.sequence,
      createdAt: turn.createdAt,
      role: TurnRole.Assistant,
      intro: turn.text,
      // SAFETY: an unreadable status is not guessed; it reads as an unavailable answer.
      modelStatus: status.success ? status.data : ModelStatus.ModelUnavailable,
      blockRefs: refs,
      ...(templateBlocks.length > 0 ? { templateBlocks } : {}),
    };
  });
  return { turns, unreadableSequences };
}
