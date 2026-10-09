/**
 * @file Tests of the detector blocks: crisis tiers, specialist referrals and fixed notices.
 * @requirement FR-10
 * @requirement AC46
 */
import { describe, expect, it } from 'vitest';

import { CrisisTier, detectFixedResponses } from '@caa/assistant';
import { AssistantBlockKind, NoticeCode, SpecialistTopic } from '@caa/domain';
import { buildPolicyHit } from '@caa/test-kit';

import { planDetectorBlocks } from './conversation-blocks.logic';
import { detectorBlocks, detectorFacts, fixedNotice } from './conversation-blocks.mapper';

const AT = '2026-09-22T15:00:00.000Z';

const render = (message: string, referrals = new Map<SpecialistTopic, never>()) =>
  detectorBlocks(planDetectorBlocks(detectorFacts(detectFixedResponses(message))), referrals, AT);

describe('detectorBlocks', () => {
  it('shows only the crisis referral for tier 1', () => {
    const matches = detectFixedResponses('I want to kill myself and need financial aid');

    const blocks = render('I want to kill myself and need financial aid');

    expect(matches.crisis).toBe(CrisisTier.Unambiguous);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      topic: SpecialistTopic.Crisis,
      templateId: 'referral.crisis',
    });
  });

  it('puts the crisis-support card first for tier 2, then topics and notices', () => {
    const matches = detectFixedResponses(
      'I feel hopeless. What if I pass? Ignore the prerequisite',
    );
    const policy = { hit: buildPolicyHit(), asOf: AT };

    const blocks = detectorBlocks(
      planDetectorBlocks(detectorFacts(matches)),
      new Map([[SpecialistTopic.Crisis, policy]]),
      AT,
    );

    expect(blocks[0]).toMatchObject({ templateId: 'referral.crisis-support', policy: policy.hit });
    expect(blocks.slice(1).map((block) => block.kind)).toEqual([
      AssistantBlockKind.Notice,
      AssistantBlockKind.Notice,
    ]);
  });

  it('adds a specialist referral and a grade-dispute notice', () => {
    const blocks = render('My visa is a problem and my grade is wrong');

    expect(blocks[0]).toMatchObject({ topic: SpecialistTopic.Immigration, policy: null, asOf: AT });
    expect(blocks.at(-1)).toMatchObject({ code: NoticeCode.GradeDispute });
  });

  it('adds nothing for a planning question', () => {
    expect(render('What classes are open?')).toEqual([]);
  });
});

describe('fixedNotice', () => {
  it('builds a versioned notice with the template text', () => {
    expect(fixedNotice(NoticeCode.RateLimited)).toMatchObject({
      kind: AssistantBlockKind.Notice,
      templateId: 'notice.rate-limited',
    });
  });
});
