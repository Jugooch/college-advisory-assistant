/**
 * @file Service tests of the answer with a fake model loop: the fixed notice for a turn that is
 * not run, the crisis answer with no model, and the loop's end states.
 * @requirement FR-10
 * @requirement AC44
 * @requirement AC46
 */
import { describe, expect, it, vi } from 'vitest';

import { GuardReason, INTRO_TEXTS, IntroId } from '@caa/assistant';
import {
  AssistantBlockKind,
  ModelStatus,
  NoticeCode,
  StudentIdSchema,
  TurnRole,
} from '@caa/domain';
import { buildActor, buildReferralBlock, syntheticId } from '@caa/test-kit';

import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { buildStoredTurn } from '../../testing/stored-turns';
import { LoopEnd, NO_USAGE } from '../conversation-loop/conversation-loop.logic';
import { createConversationAnswerService } from './conversation-answer.service';

const actor = buildActor();
const studentId = StudentIdSchema.parse(syntheticId('student', 1));
const context = { logger: createRecordingLogger() };
const detector = [buildReferralBlock()];
const input = { actor, studentId, message: 'hello', recent: [], detector };

const result = (end: LoopEnd, finalText = '') => ({
  end,
  finalText,
  blocks: [],
  toolNames: ['getAcademicSummary'],
  usage: NO_USAGE,
});

function setup(end: LoopEnd, finalText = '') {
  const run = vi.fn().mockResolvedValue(result(end, finalText));
  const service = createConversationAnswerService({
    loop: { run },
    modelId: 'test-model',
    historyTurns: 20,
  });
  return { service, run };
}

describe('ConversationAnswerService', () => {
  it('is off without a loop, and refuses to answer', async () => {
    const service = createConversationAnswerService({
      loop: null,
      modelId: null,
      historyTurns: 20,
    });

    expect(service.isEnabled).toBe(false);
    await expect(service.answer(input, context)).rejects.toThrow('The model loop is off');
  });

  it('builds an unstored outcome from the detector blocks plus one notice', () => {
    const { service } = setup(LoopEnd.Final);

    const outcome = service.unstored(detector, ModelStatus.RateLimited, NoticeCode.RateLimited);

    expect(outcome.decision.status).toBe(ModelStatus.RateLimited);
    expect(outcome.modelId).toBeNull();
    expect(outcome.blocks.map((block) => block.kind)).toEqual([
      AssistantBlockKind.Referral,
      AssistantBlockKind.Notice,
    ]);
  });

  it('answers tier-1 crisis with only the detector blocks and no model', () => {
    const { service, run } = setup(LoopEnd.Final);

    const outcome = service.crisis(detector);

    expect(outcome.decision).toEqual({
      status: ModelStatus.Guarded,
      intro: '',
      reasons: [GuardReason.CrisisUnambiguous],
    });
    expect(outcome.blocks).toEqual(detector);
    expect(outcome.modelId).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('shows the fixed sentence for a valid intro id', async () => {
    const { service } = setup(LoopEnd.Final, IntroId.AskForDetail);

    const outcome = await service.answer(input, context);

    expect(outcome.decision).toMatchObject({
      status: ModelStatus.Answered,
      intro: INTRO_TEXTS[IntroId.AskForDetail],
    });
    expect(outcome.modelId).toBe('test-model');
    expect(outcome.toolNames).toEqual(['getAcademicSummary']);
  });

  it('guards a reply that is not an intro id, never showing its text', async () => {
    const { service } = setup(LoopEnd.Final, 'You are eligible for MATH 201.');

    const outcome = await service.answer(input, context);

    expect(outcome.decision.status).toBe(ModelStatus.Guarded);
    expect(outcome.decision.intro).not.toContain('eligible');
  });

  it('adds the notice for a loop that ran out of budget', async () => {
    const { service } = setup(LoopEnd.BudgetExhausted);

    const outcome = await service.answer(input, context);

    expect(outcome.decision.status).toBe(ModelStatus.BudgetExhausted);
    expect(outcome.blocks.at(-1)).toMatchObject({ code: NoticeCode.BudgetExhausted });
  });

  it('sends the loop the history without a crisis exchange', async () => {
    const { service, run } = setup(LoopEnd.Final, IntroId.AskForDetail);
    const crisis = {
      modelId: null,
      promptVersion: 'p',
      toolSchemaVersion: 't',
      templateVersion: 'v',
      guardReasons: [GuardReason.CrisisUnambiguous],
      policyRevisions: [],
    };

    await service.answer(
      {
        ...input,
        recent: [
          buildStoredTurn(1, TurnRole.Student),
          buildStoredTurn(2, TurnRole.Assistant, { metadata: crisis }),
        ],
      },
      context,
    );

    expect(run.mock.calls[0]?.[0]).toMatchObject({ history: [], message: 'hello' });
  });
});
