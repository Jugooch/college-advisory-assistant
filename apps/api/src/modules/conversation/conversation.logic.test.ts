/**
 * @file Tests of the turn rules: what is stored and returned, the history window, the turn
 * decisions and the stale-sequence check.
 * @requirement FR-10
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC44
 * @requirement AC46
 */
import { describe, expect, it } from 'vitest';

import { GuardReason, INTRO_TEXTS, IntroId, resolveIntro } from '@caa/assistant';
import type { StoredConversationTurn } from '@caa/db';
import { ConversationTurnIdSchema, ModelStatus, NoticeCode, TurnRole } from '@caa/domain';
import { buildScheduleOptionsBlock, syntheticId } from '@caa/test-kit';

import { LoopEnd } from '../conversation-loop/conversation-loop.logic';
import {
  buildHistory,
  buildTurnsToStore,
  buildTurnView,
  decideCrisisTurn,
  decideLoopTurn,
  isSequenceCurrent,
  noticeForLoopEnd,
} from './conversation.logic';
import { buildMetadata } from './conversation.mapper';

const AT = '2026-09-01T12:00:00.000Z';
const metadata = buildMetadata('m', [], []);

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

const CRISIS = GuardReason.CrisisUnambiguous;
const stamp = (guardReasons: string[]) => buildMetadata('m', guardReasons, []);

function turn(sequence: number, role: TurnRole, extra: Partial<StoredConversationTurn> = {}) {
  return {
    id: ConversationTurnIdSchema.parse(syntheticId('conversationTurn', sequence)),
    conversationId: syntheticId('conversation', 1),
    sequence,
    role,
    text: `${role} ${String(sequence)}`,
    blockRefs: role === TurnRole.Assistant ? [] : null,
    modelStatus: role === TurnRole.Assistant ? ModelStatus.Answered : null,
    metadata: role === TurnRole.Assistant ? stamp([]) : null,
    createdAt: AT,
    ...extra,
  } as StoredConversationTurn;
}

describe('buildHistory', () => {
  it('keeps the newest turns, starting with a student message', () => {
    const stored = [1, 2, 3, 4].map((n) =>
      turn(n, n % 2 === 1 ? TurnRole.Student : TurnRole.Assistant),
    );

    expect(buildHistory(stored, 3, CRISIS).map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(buildHistory(stored, 0, CRISIS)).toEqual([]);
  });

  it('leaves out a tier-1 exchange and one with unreadable metadata', () => {
    const stored = [
      turn(1, TurnRole.Student),
      turn(2, TurnRole.Assistant, { metadata: stamp([CRISIS]) }),
      turn(3, TurnRole.Student),
      turn(4, TurnRole.Assistant, { metadata: { bad: true } }),
      turn(5, TurnRole.Student),
      turn(6, TurnRole.Assistant),
    ];

    expect(buildHistory(stored, 20, CRISIS)).toEqual([
      { role: 'user', text: `${TurnRole.Student} 5` },
      { role: 'assistant', text: `${TurnRole.Assistant} 6`, toolCalls: [] },
    ]);
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

describe('isSequenceCurrent', () => {
  it('is stale only when a stored turn proves it', () => {
    expect(isSequenceCurrent([turn(1, TurnRole.Student), turn(2, TurnRole.Assistant)], 2)).toBe(
      true,
    );
    expect(isSequenceCurrent([turn(2, TurnRole.Assistant)], 999)).toBe(false);
    expect(isSequenceCurrent([], 999)).toBe(true);
  });
});
