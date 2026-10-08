/**
 * @file Tests for the stored assistant block reference.
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockRefSchema } from './assistant-block-ref.model';

describe('AssistantBlockRefSchema', () => {
  const planRef = {
    kind: 'PLAN_EVIDENCE',
    planId: '5a000000-0000-4000-8000-000000000020',
    planRevisionId: '5a000000-0000-4000-8000-000000000021',
    revision: 2,
  };

  it('accepts reference-only variants', () => {
    const refs = [
      planRef,
      { kind: 'POLICY_RESULTS', documents: [{ documentKey: 'add-drop', revision: 1 }] },
      { kind: 'CASE_PREVIEW', reason: 'PLAN_REVIEW' },
      {
        kind: 'NOTICE',
        code: 'TOOL_FAILED',
        templateId: 'notice.tool-failed',
        templateVersion: 'v1',
      },
      {
        kind: 'REFERRAL',
        topic: 'FINANCIAL_AID',
        templateId: 'referral.aid',
        templateVersion: 'v1',
      },
    ];
    for (const ref of refs) expect(AssistantBlockRefSchema.safeParse(ref).success).toBe(true);
  });

  it('fails a block ref that carries a payload field', () => {
    expect(
      AssistantBlockRefSchema.safeParse({ ...planRef, result: { outcome: 'PASS' } }).success,
    ).toBe(false);
    expect(
      AssistantBlockRefSchema.safeParse({
        kind: 'SCHEDULE_OPTIONS',
        shownAt: '2026-10-08T09:01:05.000-05:00',
        options: [],
      }).success,
    ).toBe(false);
  });

  it('accepts a constraint proposal and an academic summary', () => {
    const proposal = {
      kind: 'CONSTRAINT_PROPOSAL',
      constraints: [
        {
          kind: 'UNAVAILABLE_TIME',
          strength: 'HARD',
          priorityRank: null,
          weekdays: ['FRIDAY'],
          startTime: '00:00',
          endTime: '24:00',
        },
      ],
    };
    const summary = { kind: 'ACADEMIC_SUMMARY', shownAt: '2026-10-08T09:01:05.000-05:00' };
    expect(AssistantBlockRefSchema.safeParse(proposal).success).toBe(true);
    expect(AssistantBlockRefSchema.safeParse(summary).success).toBe(true);
  });

  it('fails a constraint proposal with duplicate preference ranks', () => {
    const preference = {
      kind: 'ALLOWED_MODALITIES',
      strength: 'PREFERRED',
      priorityRank: 1,
      modalities: ['IN_PERSON'],
    };
    const result = AssistantBlockRefSchema.safeParse({
      kind: 'CONSTRAINT_PROPOSAL',
      constraints: [preference, { ...preference, modalities: ['HYBRID'] }],
    });
    expect(result.success).toBe(false);
  });

  it('fails a notice or referral that carries rendered text', () => {
    const notice = {
      kind: 'NOTICE',
      code: 'TOOL_FAILED',
      templateId: 'notice.tool-failed',
      templateVersion: 'v1',
    };
    expect(AssistantBlockRefSchema.safeParse({ ...notice, text: 'Rendered' }).success).toBe(false);
  });

  it('fails an unknown kind and a bad notice code', () => {
    expect(AssistantBlockRefSchema.safeParse({ kind: 'OTHER' }).success).toBe(false);
    expect(
      AssistantBlockRefSchema.safeParse({
        kind: 'NOTICE',
        code: 'NOPE',
        templateId: 'x',
        templateVersion: 'v1',
      }).success,
    ).toBe(false);
  });
});
