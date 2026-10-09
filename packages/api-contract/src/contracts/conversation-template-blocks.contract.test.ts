/**
 * @file Tests for re-rendered template blocks on stored assistant turns (ADR-0015 Amendment 3).
 */
import { describe, expect, it } from 'vitest';

import { buildRevisionView } from '../testing/plan-draft-fixtures';
import { buildResponse } from '../testing/schedule-option-fixtures';
import { ConversationResponseSchema } from './conversation.contract';

const AT = '2026-10-08T09:00:00-05:00';
const NOTICE = {
  kind: 'NOTICE',
  code: 'MODEL_UNAVAILABLE',
  templateId: 'notice.model-unavailable',
  templateVersion: '1',
  text: 'The assistant is unavailable. Use the planner form.',
};
const ASSISTANT_TURN = {
  sequence: 2,
  role: 'ASSISTANT',
  intro: 'Here is what I found.',
  modelStatus: 'ANSWERED',
  blockRefs: [],
  createdAt: AT,
};

describe('templateBlocks on a stored assistant turn', () => {
  const REFERRAL = {
    kind: 'REFERRAL',
    topic: 'CRISIS',
    templateId: 'referral.crisis',
    templateVersion: '1',
    text: 'Please call or text 988 now.',
    policy: null,
    asOf: AT,
  };
  const REFERRAL_REF = {
    kind: 'REFERRAL',
    topic: 'CRISIS',
    templateId: 'referral.crisis',
    templateVersion: '1',
  };
  const turn = (extra: object, blockRefs: readonly object[] = [REFERRAL_REF]) => ({
    ...ASSISTANT_TURN,
    blockRefs,
    ...extra,
  });
  const accepts = (t: unknown): boolean =>
    ConversationResponseSchema.safeParse({ available: true, unavailableReason: null, turns: [t] })
      .success;

  it('accepts a crisis referral ref with a matching block', () => {
    expect(accepts(turn({ templateBlocks: [{ refIndex: 0, block: REFERRAL }] }))).toBe(true);
  });

  it('accepts a notice ref with a matching notice block', () => {
    const ref = {
      kind: 'NOTICE',
      code: 'MODEL_UNAVAILABLE',
      templateId: 'notice.model-unavailable',
      templateVersion: '1',
    };
    expect(accepts(turn({ templateBlocks: [{ refIndex: 0, block: NOTICE }] }, [ref]))).toBe(true);
  });

  it('still accepts a turn without the field', () => {
    expect(accepts(turn({}))).toBe(true);
    expect(accepts(turn({ templateBlocks: [] }))).toBe(true);
  });

  it.each([
    ['SCHEDULE_OPTIONS', { kind: 'SCHEDULE_OPTIONS', result: buildResponse() }],
    ['PLAN_EVIDENCE', { kind: 'PLAN_EVIDENCE', plan: buildRevisionView() }],
    ['POLICY_RESULTS', { kind: 'POLICY_RESULTS', results: { hits: [], asOf: AT } }],
  ])('rejects a well-formed %s block', (_name, block) => {
    expect(accepts(turn({ templateBlocks: [{ refIndex: 0, block }] }))).toBe(false);
  });

  it('rejects a referral block of another topic than its ref', () => {
    const block = { ...REFERRAL, topic: 'FINANCIAL_AID' };
    expect(accepts(turn({ templateBlocks: [{ refIndex: 0, block }] }))).toBe(false);
  });

  it('rejects a notice block with another code than its ref', () => {
    const ref = {
      kind: 'NOTICE',
      code: 'TOOL_FAILED',
      templateId: 'notice.model-unavailable',
      templateVersion: '1',
    };
    expect(accepts(turn({ templateBlocks: [{ refIndex: 0, block: NOTICE }] }, [ref]))).toBe(false);
  });

  it('rejects a block with another templateId than its ref', () => {
    const block = { ...REFERRAL, templateId: 'referral.other' };
    expect(accepts(turn({ templateBlocks: [{ refIndex: 0, block }] }))).toBe(false);
  });

  it('rejects a block with another templateVersion than its ref', () => {
    const block = { ...REFERRAL, templateVersion: '2' };
    expect(accepts(turn({ templateBlocks: [{ refIndex: 0, block }] }))).toBe(false);
  });

  it('rejects an out-of-range refIndex', () => {
    expect(accepts(turn({ templateBlocks: [{ refIndex: 1, block: REFERRAL }] }))).toBe(false);
  });

  it('rejects a refIndex that points at an academic ref', () => {
    const refs = [{ kind: 'SCHEDULE_OPTIONS', shownAt: AT }];
    expect(accepts(turn({ templateBlocks: [{ refIndex: 0, block: REFERRAL }] }, refs))).toBe(false);
  });

  it('rejects a block whose kind differs from its ref', () => {
    expect(accepts(turn({ templateBlocks: [{ refIndex: 0, block: NOTICE }] }))).toBe(false);
  });

  it('rejects a repeated refIndex', () => {
    const entry = { refIndex: 0, block: REFERRAL };
    expect(accepts(turn({ templateBlocks: [entry, entry] }))).toBe(false);
  });
});
