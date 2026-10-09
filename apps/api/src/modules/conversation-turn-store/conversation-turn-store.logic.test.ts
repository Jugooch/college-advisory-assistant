/**
 * @file Tests of the stale-sequence rule and the turns to append.
 * @requirement NFR-05
 * @requirement FR-02
 * @requirement AC45
 */
import { describe, expect, it } from 'vitest';

import { ModelStatus, TurnRole } from '@caa/domain';
import { buildScheduleOptionsBlock } from '@caa/test-kit';

import { buildTurnsToStore, isSequenceCurrent } from './conversation-turn-store.logic';
import { buildMetadata } from './conversation-turn-store.mapper';

const AT = '2026-09-01T12:00:00.000Z';
const metadata = buildMetadata('m', [], []);

describe('isSequenceCurrent', () => {
  it('is current only when the caller saw the last sequence', () => {
    expect(isSequenceCurrent(2, 2)).toBe(true);
    expect(isSequenceCurrent(2, 0)).toBe(false);
    expect(isSequenceCurrent(0, 0)).toBe(true);
    expect(isSequenceCurrent(0, 999)).toBe(false);
  });
});

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
