/**
 * @file Tests for the synthetic conversation builder.
 */
import { describe, expect, it } from 'vitest';

import { ConversationSchema } from '@caa/domain';

import { buildConversation } from './conversation.builder';

describe('buildConversation', () => {
  it('defaults to student 1 in tenant A for the synthetic term', () => {
    const conversation = buildConversation();

    expect(ConversationSchema.safeParse(conversation).success).toBe(true);
    expect(conversation).toEqual({
      id: '12000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      studentId: '30000000-0000-4000-8000-000000000001',
      termId: 'b0000000-0000-4000-8000-000000000004',
      createdAt: '2026-09-22T10:00:00.000-05:00',
    });
  });

  it('derives the id from the seed and lets an override win', () => {
    expect(buildConversation({}, 3).id).toBe('12000000-0000-4000-8000-000000000003');
    expect(buildConversation({ createdAt: '2026-09-23T08:00:00.000-05:00' }).createdAt).toBe(
      '2026-09-23T08:00:00.000-05:00',
    );
  });

  it('rejects a bad timestamp', () => {
    expect(() => buildConversation({ createdAt: 'yesterday' })).toThrow();
  });
});
