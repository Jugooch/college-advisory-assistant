/**
 * @file Tests for the synthetic assistant block builders.
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockSchema, ProposedConstraintSchema } from '@caa/api-contract';
import { AssistantBlockKind } from '@caa/domain';

import {
  buildAssistantBlockOfEveryKind,
  buildCasePreviewBlock,
  buildConstraintProposalBlock,
  buildNoticeBlock,
  buildPolicyResultsBlock,
  buildProposedConstraint,
  buildReferralBlock,
} from './assistant-block.builder';
import { buildPolicyHit } from './policy-hit.builder';

describe('buildAssistantBlockOfEveryKind', () => {
  it('returns one block per kind, in enum order, each parsing with the schema', () => {
    const blocks = buildAssistantBlockOfEveryKind();

    expect(blocks.map((block) => block.kind)).toEqual(Object.values(AssistantBlockKind));
    for (const block of blocks) {
      expect(AssistantBlockSchema.safeParse(block).success).toBe(true);
    }
  });
});

describe('buildProposedConstraint', () => {
  it('is an unconfirmed PREFERRED proposal', () => {
    const proposed = buildProposedConstraint();

    expect(ProposedConstraintSchema.safeParse(proposed).success).toBe(true);
    expect(proposed.confirmed).toBe(false);
    expect(proposed.constraint.strength).toBe('PREFERRED');
  });
});

describe('buildConstraintProposalBlock', () => {
  it('holds one proposed constraint by default', () => {
    expect(buildConstraintProposalBlock()).toMatchObject({
      kind: 'CONSTRAINT_PROPOSAL',
      constraints: [{ confirmed: false }],
    });
  });
});

describe('buildPolicyResultsBlock', () => {
  it('rejects a hit that is expired at asOf', () => {
    const expired = buildPolicyHit({ effectiveTo: '2026-09-01T00:00:00.000-05:00' });

    expect(() =>
      buildPolicyResultsBlock({
        results: { hits: [expired], asOf: '2026-09-22T10:00:00.000-05:00' },
      }),
    ).toThrow();
  });
});

describe('buildReferralBlock', () => {
  it('defaults to financial aid with a matching-topic policy', () => {
    expect(buildReferralBlock()).toMatchObject({
      kind: 'REFERRAL',
      topic: 'FINANCIAL_AID',
      policy: { topic: 'FINANCIAL_AID' },
    });
  });

  it('rejects a policy of another topic', () => {
    expect(() => buildReferralBlock({ policy: buildPolicyHit() })).toThrow();
  });

  it('accepts a referral with no policy', () => {
    expect(buildReferralBlock({ policy: null })).toMatchObject({ policy: null });
  });
});

describe('buildCasePreviewBlock', () => {
  it('defaults to a plan review of plan seed 1 revision 1', () => {
    expect(buildCasePreviewBlock()).toMatchObject({
      kind: 'CASE_PREVIEW',
      reason: 'PLAN_REVIEW',
      planRevision: 1,
      discrepancySubject: null,
    });
  });

  it('rejects a plan review with no plan', () => {
    expect(() => buildCasePreviewBlock({ planId: null, planRevision: null })).toThrow();
  });
});

describe('buildNoticeBlock', () => {
  it('defaults to a rate-limited notice with template text', () => {
    expect(buildNoticeBlock()).toMatchObject({ kind: 'NOTICE', code: 'RATE_LIMITED' });
  });
});
