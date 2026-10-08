/**
 * @file Conversation turn data object: one append-only message in a conversation.
 * @module @caa/domain/models/conversation-turn
 * @requirement FR-08, FR-10, FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { StoredModelStatusSchema } from '../enums/model-status.enum';
import { TurnRole } from '../enums/turn-role.enum';
import { AssistantBlockRefSchema, PolicyRevisionRefSchema } from './assistant-block-ref.model';
import { ConversationIdSchema } from './conversation.model';

/** Branded ID so a turn ID can never be passed where another ID is expected. */
export const ConversationTurnIdSchema = z.uuid().brand<'ConversationTurnId'>();

/** Unique identifier of a {@link ConversationTurn}. */
export type ConversationTurnId = z.infer<typeof ConversationTurnIdSchema>;

/** Longest student message, in characters. */
export const STUDENT_TURN_MAX_LENGTH = 1000;

/** Longest server-written assistant intro, in characters. */
export const ASSISTANT_TURN_MAX_LENGTH = 600;

/** Most blocks one assistant turn may carry. */
export const MAX_TURN_BLOCKS = 12;

/** Most guard reason codes one assistant turn may record. */
export const MAX_GUARD_REASONS = 20;

/** Most policy revisions one assistant turn may record. */
export const MAX_TURN_POLICY_REVISIONS = 50;

/** Schema for what an assistant turn records about how it was produced. */
export const AssistantTurnMetadataSchema = z
  .strictObject({
    /** The model that answered, or `null` when no model was called. */
    modelId: z.string().min(1).max(100).nullable(),
    promptVersion: z.string().min(1).max(50),
    toolSchemaVersion: z.string().min(1).max(50),
    templateVersion: z.string().min(1).max(50),
    /** Intro and crisis outcome codes from `@caa/assistant`, not output guard codes. */
    guardReasons: z.array(z.string().min(1).max(100)).max(MAX_GUARD_REASONS).readonly(),
    /** Policy revisions the turn's tools read. */
    policyRevisions: z.array(PolicyRevisionRefSchema).max(MAX_TURN_POLICY_REVISIONS).readonly(),
  })
  .readonly();

/** What an assistant turn records about how it was produced. */
export type AssistantTurnMetadata = z.infer<typeof AssistantTurnMetadataSchema>;

/** Fields every turn has. */
const BASE_FIELDS = {
  id: ConversationTurnIdSchema,
  conversationId: ConversationIdSchema,
  /** Position in the conversation, starting at 1. */
  sequence: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
};

/**
 * Schema for a conversation turn, discriminated by `role`. Block references, model status and
 * metadata belong to assistant turns only; a student turn carrying them is refused.
 */
export const ConversationTurnSchema = z.discriminatedUnion('role', [
  z
    .strictObject({
      ...BASE_FIELDS,
      role: z.literal(TurnRole.Student),
      text: z.string().min(1).max(STUDENT_TURN_MAX_LENGTH),
    })
    .readonly(),
  z
    .strictObject({
      ...BASE_FIELDS,
      role: z.literal(TurnRole.Assistant),
      text: z.string().max(ASSISTANT_TURN_MAX_LENGTH),
      blockRefs: z.array(AssistantBlockRefSchema).max(MAX_TURN_BLOCKS).readonly(),
      modelStatus: StoredModelStatusSchema,
      metadata: AssistantTurnMetadataSchema,
    })
    .readonly(),
]);

/** A validated, immutable conversation turn. */
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

/** Raw input accepted by {@link createConversationTurn}. */
export type ConversationTurnInput = z.input<typeof ConversationTurnSchema>;

/**
 * Creates a validated, immutable conversation turn.
 *
 * @param input - Raw turn fields.
 * @returns The parsed turn.
 * @throws {z.ZodError} When a field is invalid or a role-specific field is missing or misplaced.
 */
export function createConversationTurn(input: ConversationTurnInput): ConversationTurn {
  return ConversationTurnSchema.parse(input);
}
