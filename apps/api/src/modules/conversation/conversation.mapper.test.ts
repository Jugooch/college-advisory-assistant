/**
 * @file Tests of the history window, turn decisions and metadata.
 * @requirement FR-10
 * @requirement AC44
 * @requirement AC46
 */
import { describe, expect, it } from 'vitest';

import { GuardReason, INTRO_TEXTS, IntroId } from '@caa/assistant';
import type { StoredConversationTurn } from '@caa/db';
import { ConversationTurnIdSchema, ModelStatus, TurnRole } from '@caa/domain';
import { buildNoticeBlock, buildScheduleOptionsBlock, syntheticId } from '@caa/test-kit';

import { LoopEnd, type LoopResult, NO_USAGE } from '../conversation-loop/conversation-loop.logic';
import {
  buildHistory,
  buildMetadata,
  CRISIS_DECISION,
  decideLoopTurn,
} from './conversation.mapper';

const metadata = (guardReasons: string[]) => buildMetadata('m', guardReasons, []);

function turn(sequence: number, role: TurnRole, extra: Partial<StoredConversationTurn> = {}) {
  return {
    id: ConversationTurnIdSchema.parse(syntheticId('conversationTurn', sequence)),
    conversationId: syntheticId('conversation', 1),
    sequence,
    role,
    text: `${role} ${String(sequence)}`,
    blockRefs: role === TurnRole.Assistant ? [] : null,
    modelStatus: role === TurnRole.Assistant ? ModelStatus.Answered : null,
    metadata: role === TurnRole.Assistant ? metadata([]) : null,
    createdAt: '2026-09-22T15:00:00.000Z',
    ...extra,
  } as StoredConversationTurn;
}

describe('buildHistory', () => {
  it('keeps the newest turns, starting with a student message', () => {
    const stored = [1, 2, 3, 4].map((n) =>
      turn(n, n % 2 === 1 ? TurnRole.Student : TurnRole.Assistant),
    );

    expect(buildHistory(stored, 3).map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(buildHistory(stored, 0)).toEqual([]);
  });

  it('leaves out a tier-1 exchange and one with unreadable metadata', () => {
    const stored = [
      turn(1, TurnRole.Student),
      turn(2, TurnRole.Assistant, { metadata: metadata([GuardReason.CrisisUnambiguous]) }),
      turn(3, TurnRole.Student),
      turn(4, TurnRole.Assistant, { metadata: { bad: true } }),
      turn(5, TurnRole.Student),
      turn(6, TurnRole.Assistant),
    ];

    expect(buildHistory(stored, 20).map((m) => m.role)).toEqual(['user', 'assistant']);
  });
});

describe('decideLoopTurn', () => {
  const result = (end: LoopResult['end'], finalText = ''): LoopResult => ({
    end,
    finalText,
    blocks: [],
    toolNames: [],
    usage: NO_USAGE,
  });

  it('answers a valid id and guards anything else', () => {
    const blocks = [buildScheduleOptionsBlock()];

    expect(decideLoopTurn(result(LoopEnd.Final, IntroId.ScheduleOptions), blocks)).toMatchObject({
      status: ModelStatus.Answered,
      intro: INTRO_TEXTS[IntroId.ScheduleOptions],
    });
    expect(decideLoopTurn(result(LoopEnd.Final, 'You may enrol'), blocks)).toMatchObject({
      status: ModelStatus.Guarded,
      reasons: [GuardReason.IntroNotAnId],
    });
  });

  it('gives budget and outage statuses a fixed intro', () => {
    const blocks = [buildNoticeBlock()];

    expect(decideLoopTurn(result(LoopEnd.BudgetExhausted), blocks).status).toBe(
      ModelStatus.BudgetExhausted,
    );
    expect(decideLoopTurn(result(LoopEnd.ModelUnavailable), blocks).status).toBe(
      ModelStatus.ModelUnavailable,
    );
  });

  it('has an empty intro for tier-1 crisis', () => {
    expect(CRISIS_DECISION).toMatchObject({ intro: '', status: ModelStatus.Guarded });
  });
});
