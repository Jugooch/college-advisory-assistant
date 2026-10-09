/**
 * @file Tests of the turn rules: what is stored and returned, and the turn decisions.
 * @requirement FR-10
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC44
 * @requirement AC46
 */
import { describe, expect, it } from 'vitest';

import { GuardReason, INTRO_TEXTS, IntroId, resolveIntro } from '@caa/assistant';
import { ModelStatus, NoticeCode, TurnRole } from '@caa/domain';
import { buildScheduleOptionsBlock } from '@caa/test-kit';

import { LoopEnd } from '../conversation-loop/conversation-loop.logic';
import {
  buildTurnsToStore,
  buildTurnView,
  decideCrisisTurn,
  decideLoopTurn,
  noticeForLoopEnd,
} from './conversation.logic';
import { buildMetadata } from './conversation.mapper';

const AT = '2026-09-01T12:00:00.000Z';
const metadata = buildMetadata('m', [], []);
const CRISIS = GuardReason.CrisisUnambiguous;

describe('buildTurnsToStore', () => {
  it('stores the message and the intro with block references only', () => {
    const decision = { status: ModelStatus.Answered, intro: 'Intro.', reasons: [] };

    const turns = buildTurnsToStore({
      message: 'Hi',
      decision,
      blocks: [buildScheduleOptionsBlock()],
      metadata,
      at: AT,
    });

    expect(turns.map((t) => t.role)).toEqual([TurnRole.Student, TurnRole.Assistant]);
    expect(JSON.stringify(turns[1])).not.toContain('"result"');
  });

  it.each([ModelStatus.RateLimited, ModelStatus.Disabled])('refuses to store %s', (status) => {
    const decision = { status, intro: '', reasons: [] };

    expect(() =>
      buildTurnsToStore({ message: 'Hi', decision, blocks: [], metadata, at: AT }),
    ).toThrow();
  });
});

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
