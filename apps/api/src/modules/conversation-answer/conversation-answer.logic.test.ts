/**
 * @file Tests of the turn decisions.
 * @requirement FR-10
 * @requirement NFR-05
 * @requirement AC44
 * @requirement AC46
 */
import { describe, expect, it } from 'vitest';

import { GuardReason, INTRO_TEXTS, IntroId, resolveIntro } from '@caa/assistant';
import { ModelStatus, NoticeCode } from '@caa/domain';
import { buildScheduleOptionsBlock } from '@caa/test-kit';

import { LoopEnd } from '../conversation-loop/conversation-loop.logic';
import { decideCrisisTurn, decideLoopTurn, noticeForLoopEnd } from './conversation-answer.logic';

const CRISIS = GuardReason.CrisisUnambiguous;

describe('decideLoopTurn', () => {
  const intros = (text: string, kinds = [buildScheduleOptionsBlock().kind]) => ({
    resolved: resolveIntro(text, kinds),
    fallback: 'Fallback.',
  });

  it('answers a valid id and guards anything else', () => {
    expect(decideLoopTurn(LoopEnd.Final, intros(IntroId.ScheduleOptions))).toMatchObject({
      status: ModelStatus.Answered,
      intro: INTRO_TEXTS[IntroId.ScheduleOptions],
    });
    expect(decideLoopTurn(LoopEnd.Final, intros('You may enrol'))).toMatchObject({
      status: ModelStatus.Guarded,
      reasons: [GuardReason.IntroNotAnId],
    });
  });

  it('gives budget and outage statuses the fallback intro, ahead of a guarded reply', () => {
    expect(decideLoopTurn(LoopEnd.BudgetExhausted, intros('prose'))).toEqual({
      status: ModelStatus.BudgetExhausted,
      intro: 'Fallback.',
      reasons: [],
    });
    expect(decideLoopTurn(LoopEnd.ModelUnavailable, intros('prose')).status).toBe(
      ModelStatus.ModelUnavailable,
    );
  });
});

describe('decideCrisisTurn', () => {
  it('has an empty intro and the crisis reason', () => {
    expect(decideCrisisTurn(CRISIS)).toEqual({
      status: ModelStatus.Guarded,
      intro: '',
      reasons: [CRISIS],
    });
  });
});

describe('noticeForLoopEnd', () => {
  it('explains only a budget or outage end', () => {
    expect(noticeForLoopEnd(LoopEnd.BudgetExhausted)).toBe(NoticeCode.BudgetExhausted);
    expect(noticeForLoopEnd(LoopEnd.ModelUnavailable)).toBe(NoticeCode.ModelUnavailable);
    expect(noticeForLoopEnd(LoopEnd.Final)).toBeNull();
  });
});
