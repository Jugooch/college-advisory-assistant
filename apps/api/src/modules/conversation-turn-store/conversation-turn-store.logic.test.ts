/**
 * @file Tests of the stale-sequence rule.
 * @requirement FR-02
 * @requirement AC45
 */
import { describe, expect, it } from 'vitest';

import { isSequenceCurrent } from './conversation-turn-store.logic';

describe('isSequenceCurrent', () => {
  it('is current only when the caller saw the last sequence', () => {
    expect(isSequenceCurrent(2, 2)).toBe(true);
    expect(isSequenceCurrent(2, 0)).toBe(false);
    expect(isSequenceCurrent(0, 0)).toBe(true);
    expect(isSequenceCurrent(0, 999)).toBe(false);
  });
});
