/**
 * @file Tests for constraint proposals: always PREFERRED, ranked in order, unconfirmed.
 * @requirement FR-08
 * @requirement AC43
 */
import { describe, expect, it } from 'vitest';

import { ConstraintStrength } from '@caa/domain';
import { buildUnavailableTime } from '@caa/test-kit';

import { toProposals } from './conversation-tool-proposals.logic';

describe('toProposals', () => {
  it('makes every constraint PREFERRED, ranked in order and unconfirmed', () => {
    const proposals = toProposals([buildUnavailableTime(), buildUnavailableTime()]);

    expect(proposals.map((proposal) => proposal.constraint.strength)).toEqual([
      ConstraintStrength.Preferred,
      ConstraintStrength.Preferred,
    ]);
    expect(proposals.map((proposal) => proposal.constraint.priorityRank)).toEqual([1, 2]);
    expect(proposals.map((proposal) => proposal.confirmed)).toEqual([false, false]);
  });
});
