/**
 * @file Conversation data object: one student's chat for one term.
 * @module @caa/domain/models/conversation
 * @requirement FR-08, FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';
import { StudentIdSchema } from './student.model';
import { TermIdSchema } from './term.model';

/** Branded ID so a conversation ID can never be passed where another ID is expected. */
export const ConversationIdSchema = z.uuid().brand<'ConversationId'>();

/** Unique identifier of a {@link Conversation}. */
export type ConversationId = z.infer<typeof ConversationIdSchema>;

/** Schema for a conversation. There is one per tenant, student and term. */
export const ConversationSchema = z
  .object({
    id: ConversationIdSchema,
    tenantId: InstitutionIdSchema,
    studentId: StudentIdSchema,
    termId: TermIdSchema,
    /** When the conversation started. ISO 8601 with offset. */
    createdAt: z.iso.datetime({ offset: true }),
  })
  .readonly();

/** A validated, immutable conversation. */
export type Conversation = z.infer<typeof ConversationSchema>;

/** Raw input accepted by {@link createConversation}. */
export type ConversationInput = z.input<typeof ConversationSchema>;

/**
 * Creates a validated, immutable conversation.
 *
 * @param input - Raw conversation fields.
 * @returns The parsed conversation.
 * @throws {z.ZodError} When a field is invalid.
 */
export function createConversation(input: ConversationInput): Conversation {
  return ConversationSchema.parse(input);
}
