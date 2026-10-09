/**
 * @file Tests of the turn response rule.
 * @requirement FR-02
 */
import { describe, expect, it } from 'vitest';

import { ModelStatus } from '@caa/domain';

import { buildTurnView } from './conversation.logic';

describe('buildTurnView', () => {
  it('carries the decision and sequence', () => {
    const decision = { status: ModelStatus.Disabled, intro: 'x', reasons: [] };

    expect(buildTurnView(decision, [], null)).toEqual({
      sequence: null,
      intro: 'x',
      modelStatus: ModelStatus.Disabled,
      blocks: [],
    });
  });
});
