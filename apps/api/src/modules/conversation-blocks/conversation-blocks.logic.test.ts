/**
 * @file Tests of block ordering, the block cap, policy revisions and stored block references.
 * @requirement FR-10
 * @requirement FR-14
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockKind, MAX_TURN_BLOCKS, NoticeCode, SpecialistTopic } from '@caa/domain';
import {
  buildAssistantBlockOfEveryKind,
  buildNoticeBlock,
  buildPolicyResultsBlock,
  buildReferralBlock,
  buildScheduleOptionsBlock,
} from '@caa/test-kit';

import {
  type DetectorFacts,
  orderBlocks,
  planDetectorBlocks,
  policyRevisionsOf,
  referralTopics,
  toBlockRef,
} from './conversation-blocks.logic';

const AT = '2026-09-01T12:00:00.000Z';

describe('orderBlocks', () => {
  it('orders detectors, tools, then the status notice', () => {
    const detector = buildReferralBlock();
    const tool = buildScheduleOptionsBlock();
    const status = buildNoticeBlock();

    expect(orderBlocks([detector], [tool], status)).toEqual([detector, tool, status]);
    expect(orderBlocks([detector], [tool], null)).toEqual([detector, tool]);
  });

  it('cuts tool blocks, never detector blocks or the status notice, to the cap', () => {
    const detector = Array.from({ length: 3 }, () => buildReferralBlock());
    const tools = Array.from({ length: 20 }, () => buildScheduleOptionsBlock());
    const status = buildNoticeBlock();

    const blocks = orderBlocks(detector, tools, status);

    expect(blocks).toHaveLength(MAX_TURN_BLOCKS);
    expect(blocks.slice(0, 3)).toEqual(detector);
    expect(blocks.at(-1)).toBe(status);
  });
});

describe('policyRevisionsOf', () => {
  it('lists each policy revision once, from results and referral documents', () => {
    const revisions = policyRevisionsOf([
      buildPolicyResultsBlock(),
      buildPolicyResultsBlock(),
      buildReferralBlock(),
      buildNoticeBlock(),
    ]);

    expect(revisions).toHaveLength(2);
  });
});

describe('toBlockRef', () => {
  it('keeps only references for every kind of block', () => {
    const refs = buildAssistantBlockOfEveryKind().map((block) => toBlockRef(block, AT));

    expect(refs.map((ref) => ref.kind)).toEqual(
      buildAssistantBlockOfEveryKind().map((block) => block.kind),
    );
    expect(JSON.stringify(refs)).not.toContain('"result"');
    expect(refs.find((ref) => ref.kind === AssistantBlockKind.ScheduleOptions)).toEqual({
      kind: AssistantBlockKind.ScheduleOptions,
      shownAt: AT,
    });
  });
});

const NO_FACTS: DetectorFacts = {
  isCrisisUnambiguous: false,
  isCrisisAmbiguous: false,
  specialistTopics: [],
  isHypothetical: false,
  isOverride: false,
  isGradeDispute: false,
};

describe('planDetectorBlocks', () => {
  it('plans only the crisis referral for tier 1, whatever else matched', () => {
    const slots = planDetectorBlocks({
      ...NO_FACTS,
      isCrisisUnambiguous: true,
      isCrisisAmbiguous: true,
      specialistTopics: [SpecialistTopic.Immigration],
      isGradeDispute: true,
    });

    expect(slots).toEqual([{ slot: 'CRISIS' }]);
    expect(referralTopics(slots)).toEqual([SpecialistTopic.Crisis]);
  });

  it('orders crisis support, then topics, then notices for tier 2', () => {
    const slots = planDetectorBlocks({
      ...NO_FACTS,
      isCrisisAmbiguous: true,
      specialistTopics: [SpecialistTopic.Immigration],
      isHypothetical: true,
      isOverride: true,
      isGradeDispute: true,
    });

    expect(slots).toEqual([
      { slot: 'CRISIS_SUPPORT' },
      { slot: 'REFERRAL', topic: SpecialistTopic.Immigration },
      { slot: 'NOTICE', code: NoticeCode.HypotheticalNotSupported },
      { slot: 'NOTICE', code: NoticeCode.OverrideProcess },
      { slot: 'NOTICE', code: NoticeCode.GradeDispute },
    ]);
    expect(referralTopics(slots)).toEqual([SpecialistTopic.Crisis, SpecialistTopic.Immigration]);
  });

  it('plans nothing for a planning question', () => {
    expect(planDetectorBlocks(NO_FACTS)).toEqual([]);
  });
});
