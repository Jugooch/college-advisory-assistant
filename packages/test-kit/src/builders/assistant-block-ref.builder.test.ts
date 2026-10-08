/**
 * @file Tests for the synthetic assistant block reference builders.
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockKind, AssistantBlockRefSchema } from '@caa/domain';

import {
  buildAssistantBlockRef,
  buildAssistantBlockRefOfEveryKind,
} from './assistant-block-ref.builder';

describe('buildAssistantBlockRef', () => {
  it('defaults to a policy results block citing late-registration revision 1', () => {
    expect(buildAssistantBlockRef()).toEqual({
      kind: 'POLICY_RESULTS',
      documents: [{ documentKey: 'late-registration', revision: 1 }],
    });
  });

  it('accepts a complete block of another kind', () => {
    expect(buildAssistantBlockRef({ kind: 'CASE_PREVIEW', reason: 'PLAN_REVIEW' })).toEqual({
      kind: 'CASE_PREVIEW',
      reason: 'PLAN_REVIEW',
    });
  });

  it('rejects a block with an extra field', () => {
    expect(() =>
      buildAssistantBlockRef({ kind: 'CASE_PREVIEW', reason: 'PLAN_REVIEW', extra: 1 } as never),
    ).toThrow();
  });
});

describe('buildAssistantBlockRefOfEveryKind', () => {
  it('returns one parsing block per kind, in enum order', () => {
    const blocks = buildAssistantBlockRefOfEveryKind();

    expect(blocks.map((b) => b.kind)).toEqual(Object.values(AssistantBlockKind));
    expect(blocks.every((b) => AssistantBlockRefSchema.safeParse(b).success)).toBe(true);
  });
});
