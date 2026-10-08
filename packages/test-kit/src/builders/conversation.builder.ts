/**
 * @file Builds synthetic conversations for tests.
 * @module @caa/test-kit/builders/conversation
 */
import { type Conversation, type ConversationInput, createConversation } from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_SCHEDULE_TERM } from '../fixtures/synthetic-schedule-term';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid conversation for student seed 1 in tenant A for the synthetic schedule term,
 * started 2026-09-22.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes conversations; drives the default `id`.
 * @returns A validated conversation.
 */
export function buildConversation(
  overrides: Partial<ConversationInput> = {},
  seed = 1,
): Conversation {
  return createConversation({
    id: syntheticId('conversation', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    studentId: syntheticId('student', 1),
    termId: SYNTHETIC_SCHEDULE_TERM.termId,
    createdAt: '2026-09-22T10:00:00.000-05:00',
    ...overrides,
  });
}
