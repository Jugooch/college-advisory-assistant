/**
 * @file Tests for mapping stored turns to the transcript: block references only, and a stored
 * value that no longer parses becomes an unavailable notice.
 * @requirement FR-01
 * @requirement AC46
 */
import { describe, expect, it } from 'vitest';

import { ConversationTurnViewSchema } from '@caa/api-contract';
import {
  CRISIS_TEMPLATE_ID,
  PLANNER_INPUT_TEMPLATE_ID,
  renderNotice,
  renderReferral,
  TEMPLATE_VERSION,
} from '@caa/assistant';
import type { StoredConversationTurn } from '@caa/db';
import {
  AssistantBlockKind,
  MAX_TURN_BLOCKS,
  ModelStatus,
  NoticeCode,
  SpecialistTopic,
  TurnRole,
} from '@caa/domain';
import {
  buildAssistantBlockRef,
  buildAssistantBlockRefOfEveryKind,
  syntheticId,
} from '@caa/test-kit';

import { toTranscriptTurns } from './conversation-store.logic';
import { renderTemplateBlock } from './conversation-store.mapper';

const isAcademic = (ref: { kind: string }): boolean =>
  ref.kind !== AssistantBlockKind.Referral && ref.kind !== AssistantBlockKind.Notice;

const CREATED_AT = '2026-09-22T15:00:00.000Z';

function student(sequence: number, text = 'What can I take?'): StoredConversationTurn {
  return {
    id: syntheticId('conversationTurn', sequence) as StoredConversationTurn['id'],
    conversationId: syntheticId('conversation', 1) as StoredConversationTurn['conversationId'],
    sequence,
    role: TurnRole.Student,
    text,
    blockRefs: null,
    modelStatus: null,
    metadata: null,
    createdAt: CREATED_AT,
  };
}

function assistant(
  sequence: number,
  overrides: Partial<StoredConversationTurn> = {},
): StoredConversationTurn {
  return {
    ...student(sequence, 'Here is a summary.'),
    role: TurnRole.Assistant,
    blockRefs: [],
    modelStatus: ModelStatus.Answered,
    ...overrides,
  };
}

describe('toTranscriptTurns', () => {
  it('maps a student turn to its text and an assistant turn to its intro and status', () => {
    const { turns, unreadableSequences } = toTranscriptTurns(
      [student(1), assistant(2)],
      renderTemplateBlock,
    );

    expect(turns).toEqual([
      { sequence: 1, createdAt: CREATED_AT, role: TurnRole.Student, text: 'What can I take?' },
      {
        sequence: 2,
        createdAt: CREATED_AT,
        role: TurnRole.Assistant,
        intro: 'Here is a summary.',
        modelStatus: ModelStatus.Answered,
        blockRefs: [],
      },
    ]);
    expect(unreadableSequences).toEqual([]);
  });

  it('keeps every kind of stored reference as stored, with a past result showing only shownAt', () => {
    const refs = buildAssistantBlockRefOfEveryKind();

    const { turns } = toTranscriptTurns([assistant(2, { blockRefs: refs })], renderTemplateBlock);

    expect(turns[0]).toMatchObject({ blockRefs: refs });
    const scheduleRef = refs.find((ref) => ref.kind === AssistantBlockKind.ScheduleOptions);
    expect(Object.keys(scheduleRef ?? {}).sort()).toEqual(['kind', 'shownAt']);
  });

  it('replaces only the reference that no longer parses with an unavailable notice', () => {
    const good = buildAssistantBlockRef();

    const { turns, unreadableSequences } = toTranscriptTurns(
      [assistant(2, { blockRefs: [good, { kind: 'RETIRED_KIND', result: { secret: 'x' } }] })],
      renderTemplateBlock,
    );

    expect(turns[0]).toMatchObject({
      blockRefs: [
        good,
        {
          kind: AssistantBlockKind.Notice,
          code: NoticeCode.ToolFailed,
          templateId: 'transcript-block-unavailable',
        },
      ],
    });
    expect(unreadableSequences).toEqual([2]);
  });

  it('shows an unavailable notice when a turn holds more references than the limit', () => {
    const good = buildAssistantBlockRef();
    const refs = Array.from({ length: MAX_TURN_BLOCKS + 1 }, () => good);

    const { turns, unreadableSequences } = toTranscriptTurns(
      [assistant(2, { blockRefs: refs })],
      renderTemplateBlock,
    );

    const shown = (turns[0] as { blockRefs: readonly unknown[] }).blockRefs;
    expect(shown).toHaveLength(MAX_TURN_BLOCKS);
    expect(shown.at(-1)).toMatchObject({ templateId: 'transcript-block-unavailable' });
    expect(unreadableSequences).toEqual([2]);
  });

  it('shows one unavailable notice when the stored references are not a list', () => {
    const { turns, unreadableSequences } = toTranscriptTurns(
      [assistant(2, { blockRefs: 'garbage' })],
      renderTemplateBlock,
    );

    expect(turns[0]).toMatchObject({ blockRefs: [{ kind: AssistantBlockKind.Notice }] });
    expect(unreadableSequences).toEqual([2]);
  });

  it('does not guess a stored status that no longer parses', () => {
    const { turns, unreadableSequences } = toTranscriptTurns(
      [assistant(2, { modelStatus: null })],
      renderTemplateBlock,
    );

    expect(turns[0]).toMatchObject({ modelStatus: ModelStatus.ModelUnavailable });
    expect(unreadableSequences).toEqual([2]);
  });
});

describe('toTranscriptTurns template blocks', () => {
  const crisisRef = {
    kind: AssistantBlockKind.Referral,
    topic: SpecialistTopic.Crisis,
    templateId: CRISIS_TEMPLATE_ID,
    templateVersion: TEMPLATE_VERSION,
  };
  const noticeRef = {
    kind: AssistantBlockKind.Notice,
    code: NoticeCode.PlannerInputNeeded,
    templateId: PLANNER_INPUT_TEMPLATE_ID,
    templateVersion: TEMPLATE_VERSION,
  };
  const assistantView = (blockRefs: unknown[]) => {
    const [turn] = toTranscriptTurns([assistant(2, { blockRefs })], renderTemplateBlock).turns;
    return ConversationTurnViewSchema.parse(turn);
  };

  it('re-renders a stored crisis referral with policy null and the turn time as asOf', () => {
    const turn = assistantView([crisisRef]);

    expect(turn.role === TurnRole.Assistant && turn.templateBlocks).toEqual([
      {
        refIndex: 0,
        block: {
          ...crisisRef,
          text: renderReferral(SpecialistTopic.Crisis),
          policy: null,
          asOf: CREATED_AT,
        },
      },
    ]);
  });

  it('re-renders a stored notice at its position among other references', () => {
    const plan = buildAssistantBlockRef();
    const turn = assistantView([plan, noticeRef]);

    expect(turn.role === TurnRole.Assistant && turn.templateBlocks).toEqual([
      { refIndex: 1, block: { ...noticeRef, text: renderNotice(NoticeCode.PlannerInputNeeded) } },
    ]);
  });

  it('never re-renders an academic reference', () => {
    const turn = assistantView([...buildAssistantBlockRefOfEveryKind()].filter(isAcademic));

    expect(turn.role === TurnRole.Assistant && turn.templateBlocks).toBeUndefined();
  });

  it('omits the entry for an older template version or an unknown template id', () => {
    const turn = assistantView([
      { ...crisisRef, templateVersion: '2025-01-01.1' },
      { ...noticeRef, templateId: 'notice.invented' },
    ]);

    expect(turn.role === TurnRole.Assistant && turn.templateBlocks).toBeUndefined();
  });

  it('omits the entry for the unavailable-block stand-in', () => {
    const turn = assistantView(['garbage']);

    expect(turn.role === TurnRole.Assistant && turn.templateBlocks).toBeUndefined();
  });
});
