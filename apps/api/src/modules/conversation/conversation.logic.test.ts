/**
 * @file Tests of what is stored and returned for a turn.
 * @requirement FR-14
 * @requirement NFR-05
 */
import { describe, expect, it } from 'vitest';

import { ModelStatus, TurnRole } from '@caa/domain';
import { buildScheduleOptionsBlock } from '@caa/test-kit';

import { buildTurnsToStore, buildTurnView } from './conversation.logic';
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
