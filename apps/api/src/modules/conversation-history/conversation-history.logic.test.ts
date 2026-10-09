/**
 * @file Tests of the model's history window: the newest turns starting with a student message,
 * and no tier-1 crisis or unreadable exchange.
 * @requirement FR-10
 * @requirement FR-14
 * @requirement AC46
 */
import { describe, expect, it } from 'vitest';

import { GuardReason } from '@caa/assistant';
import { TurnRole } from '@caa/domain';

import { buildStoredTurn } from '../../testing/stored-turns';
import { buildMetadata } from '../conversation-turn-store/conversation-turn-store.mapper';
import { buildHistory } from './conversation-history.logic';

const CRISIS = GuardReason.CrisisUnambiguous;
const stamp = (guardReasons: string[]) => buildMetadata('m', guardReasons, []);
const student = (sequence: number) => buildStoredTurn(sequence, TurnRole.Student);
const assistant = (sequence: number, metadata: unknown = stamp([])) =>
  buildStoredTurn(sequence, TurnRole.Assistant, { metadata });

describe('buildHistory', () => {
  it('keeps the newest turns, starting with a student message', () => {
    const stored = [student(1), assistant(2), student(3), assistant(4)];

    expect(buildHistory(stored, 3, CRISIS).map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(buildHistory(stored, 0, CRISIS)).toEqual([]);
  });

  it('leaves out a tier-1 exchange and one with unreadable metadata', () => {
    const stored = [
      student(1),
      assistant(2, stamp([CRISIS])),
      student(3),
      assistant(4, { bad: true }),
      student(5),
      assistant(6),
    ];

    expect(buildHistory(stored, 20, CRISIS)).toEqual([
      { role: 'user', text: `${TurnRole.Student} 5` },
      { role: 'assistant', text: `${TurnRole.Assistant} 6`, toolCalls: [] },
    ]);
  });
});
