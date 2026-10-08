/**
 * @file Tests for mapping stored turns to the transcript: block references only, and a stored
 * value that no longer parses becomes an unavailable notice.
 * @requirement FR-01
 * @requirement AC46
 */
import { describe, expect, it } from 'vitest';

import type { StoredConversationTurn } from '@caa/db';
import { AssistantBlockKind, ModelStatus, NoticeCode, TurnRole } from '@caa/domain';
import {
  buildAssistantBlockRef,
  buildAssistantBlockRefOfEveryKind,
  syntheticId,
} from '@caa/test-kit';

import { toTranscriptTurns } from './conversation-store.logic';

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
    const { turns, unreadableSequences } = toTranscriptTurns([student(1), assistant(2)]);

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

    const { turns } = toTranscriptTurns([assistant(2, { blockRefs: refs })]);

    expect(turns[0]).toMatchObject({ blockRefs: refs });
    const scheduleRef = refs.find((ref) => ref.kind === AssistantBlockKind.ScheduleOptions);
    expect(Object.keys(scheduleRef ?? {}).sort()).toEqual(['kind', 'shownAt']);
  });

  it('replaces only the reference that no longer parses with an unavailable notice', () => {
    const good = buildAssistantBlockRef();

    const { turns, unreadableSequences } = toTranscriptTurns([
      assistant(2, { blockRefs: [good, { kind: 'RETIRED_KIND', result: { secret: 'x' } }] }),
    ]);

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

  it('shows one unavailable notice when the stored references are not a list', () => {
    const { turns, unreadableSequences } = toTranscriptTurns([
      assistant(2, { blockRefs: 'garbage' }),
    ]);

    expect(turns[0]).toMatchObject({ blockRefs: [{ kind: AssistantBlockKind.Notice }] });
    expect(unreadableSequences).toEqual([2]);
  });

  it('does not guess a stored status that no longer parses', () => {
    const { turns, unreadableSequences } = toTranscriptTurns([assistant(2, { modelStatus: null })]);

    expect(turns[0]).toMatchObject({ modelStatus: ModelStatus.ModelUnavailable });
    expect(unreadableSequences).toEqual([2]);
  });
});
