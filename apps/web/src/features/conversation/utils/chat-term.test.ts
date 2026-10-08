/**
 * @file Tests for reading the planner's term text for chat.
 */
import { describe, expect, it } from 'vitest';

import { syntheticId } from '@caa/test-kit';

import { readChatTerm } from './chat-term';

describe('readChatTerm', () => {
  it('returns a valid term ID', () => {
    const id = syntheticId('term', 1);

    expect(readChatTerm(id)).toBe(id);
  });

  it.each(['', 'fall-2026'])('returns null for %j', (text) => {
    expect(readChatTerm(text)).toBeNull();
  });
});
