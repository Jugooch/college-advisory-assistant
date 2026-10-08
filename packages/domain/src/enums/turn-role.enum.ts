/**
 * @file Who wrote a conversation turn.
 * @module @caa/domain/enums/turn-role
 * @requirement FR-08, FR-10, FR-14
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

/** Who wrote a conversation turn. */
export const TurnRole = {
  Student: 'STUDENT',
  Assistant: 'ASSISTANT',
} as const;

/** Union of every {@link TurnRole} value. */
export type TurnRole = (typeof TurnRole)[keyof typeof TurnRole];

/** Runtime schema for {@link TurnRole}. */
export const TurnRoleSchema = z.enum(TurnRole);
