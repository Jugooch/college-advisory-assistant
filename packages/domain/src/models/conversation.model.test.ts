/**
 * @file Tests for the conversation data object.
 */
import { describe, expect, it } from 'vitest';

import { type ConversationInput, createConversation } from './conversation.model';

const CONVERSATION: ConversationInput = {
  id: '5a000000-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '5a000000-0000-4000-8000-000000000002',
  termId: '5a000000-0000-4000-8000-000000000003',
  createdAt: '2026-10-08T09:00:00.000-05:00',
};

describe('createConversation', () => {
  it('accepts a valid conversation', () => {
    expect(createConversation(CONVERSATION)).toEqual(CONVERSATION);
  });

  it('rejects a missing tenant', () => {
    const input = { ...CONVERSATION, tenantId: undefined };
    expect(() => createConversation(input as unknown as ConversationInput)).toThrow();
  });
});
