/**
 * @file T06 scenarios: intent extraction (hard and preferred). A proposed constraint is always a
 * PREFERRED, unconfirmed chip, and only the student's confirmed form state reaches the solver.
 * @module @caa/tests/support/eval-scenarios/intent-extraction
 * @requirement FR-08
 * @requirement FR-10
 */
import assert from 'node:assert/strict';

import { finalStep, scriptedToolCall, toolCallStep } from '@caa/assistant';

import { blocksOf, Dimension, nth, type Scenario } from '../eval-runner';
import { BOTH_COURSES } from '../plan-drafts-harness';

/**
 * A "no Fridays" constraint; a HARD one has no rank and a PREFERRED one has rank 1 (domain rule).
 * @param strength - The strength.
 */
const noFridays = (strength: 'HARD' | 'PREFERRED') => ({
  kind: 'UNAVAILABLE_TIME',
  strength,
  priorityRank: strength === 'HARD' ? null : 1,
  weekdays: ['FRIDAY'],
  startTime: '00:00',
  endTime: '24:00',
});
const CONSTRAINT_PROPOSAL =
  'Here are the planning choices I understood. Please review them before continuing.';
const ASK_FOR_DETAIL =
  'Could you tell me a little more about what you would like to plan or look up?';

const propose = (id: string, strength: 'HARD' | 'PREFERRED') =>
  toolCallStep(scriptedToolCall(id, 'propose_constraints', { constraints: [noFridays(strength)] }));

/**
 * Every constraint of every proposal in the turns must be a PREFERRED, unconfirmed chip.
 * @param turns - The turns.
 */
function assertChipsOnly(
  turns: readonly { readonly blocks: readonly { readonly kind: string }[] }[],
): void {
  for (const turn of turns) {
    for (const block of turn.blocks.filter((item) => item.kind === 'CONSTRAINT_PROPOSAL')) {
      const constraints = (
        block as unknown as {
          constraints: readonly { constraint: { strength: string }; confirmed: boolean }[];
        }
      ).constraints;
      assert.ok(constraints.length >= 1);
      for (const chip of constraints) {
        assert.equal(chip.constraint.strength, 'PREFERRED');
        assert.equal(chip.confirmed, false);
      }
    }
  }
}

const intentHardWordingBecomesAPreferredChip: Scenario = {
  id: 'intent-hard-wording-becomes-a-preferred-chip',
  dimension: Dimension.IntentExtraction,
  releaseBlocker: true,
  anyModel: true,
  steps: [propose('a', 'HARD'), finalStep('CONSTRAINT_PROPOSAL')],
  turns: [{ message: 'I must never have class on Fridays. No Fridays at all.' }],
  check: ({ turns, scripted }) => {
    assertChipsOnly(turns);
    if (scripted) {
      assert.equal(nth(turns, 0).modelStatus, 'ANSWERED');
      assert.equal(nth(turns, 0).intro, CONSTRAINT_PROPOSAL);
      assert.equal(blocksOf(nth(turns, 0), 'CONSTRAINT_PROPOSAL').length, 1);
    }
  },
};

const intentPreferredWordingBecomesAPreferredChip: Scenario = {
  id: 'intent-preferred-wording-becomes-a-preferred-chip',
  dimension: Dimension.IntentExtraction,
  releaseBlocker: true,
  anyModel: true,
  steps: [propose('a', 'PREFERRED'), finalStep('CONSTRAINT_PROPOSAL')],
  turns: [{ message: "I'd rather avoid Friday classes if possible." }],
  check: ({ turns, scripted }) => {
    assertChipsOnly(turns);
    if (scripted) {
      assert.equal(blocksOf(nth(turns, 0), 'CONSTRAINT_PROPOSAL').length, 1);
    }
  },
};

const intentAnUnconfirmedProposalNeverReachesTheSolver: Scenario = {
  id: 'intent-an-unconfirmed-proposal-never-reaches_the_solver',
  dimension: Dimension.IntentExtraction,
  releaseBlocker: true,
  anyModel: false,
  plans: true,
  steps: [
    propose('a', 'HARD'),
    finalStep('CONSTRAINT_PROPOSAL'),
    toolCallStep(scriptedToolCall('b', 'request_plan')),
    finalStep('ASK_FOR_DETAIL'),
  ],
  turns: [{ message: 'No Fridays, ever.' }, { message: 'Now show me my options.' }],
  check: ({ turns }) => {
    assertChipsOnly(turns);
    // The form is empty, so the plan tool asks for it; nothing was scheduled from the chip.
    assert.equal(blocksOf(nth(turns, 1), 'SCHEDULE_OPTIONS').length, 0);
    assert.deepEqual(
      blocksOf(nth(turns, 1), 'NOTICE').map((block) => block.code),
      ['PLANNER_INPUT_NEEDED'],
    );
    assert.equal(nth(turns, 1).intro, ASK_FOR_DETAIL);
  },
};

const intentOnlyTheConfirmedFormStateIsScheduled: Scenario = {
  id: 'intent-only-the-confirmed-form-state-is-scheduled',
  dimension: Dimension.IntentExtraction,
  releaseBlocker: true,
  anyModel: false,
  plans: true,
  steps: [toolCallStep(scriptedToolCall('a', 'request_plan')), finalStep('SCHEDULE_OPTIONS')],
  turns: [
    {
      message: 'Show my options with the hard Friday rule I confirmed.',
      options: {
        plannerInputs: {
          ...BOTH_COURSES,
          constraints: [noFridays('HARD')],
        },
      },
    },
  ],
  check: ({ turns }) => {
    // MATH 102 meets Friday in every published section, so a confirmed hard rule leaves no option.
    const block = nth(blocksOf(nth(turns, 0), 'SCHEDULE_OPTIONS'), 0);
    const result = block.result as { outcome: string; options?: readonly unknown[] };
    assert.notEqual(result.outcome, 'OPTIONS_FOUND');
    assert.deepEqual(result.options ?? [], []);
  },
};

const intentDemoModelProposesAChipForNoFridays: Scenario = {
  id: 'intent-demo-model-proposes-a-chip-for-no-fridays',
  dimension: Dimension.IntentExtraction,
  releaseBlocker: false,
  anyModel: true,
  steps: [propose('a', 'PREFERRED'), finalStep('CONSTRAINT_PROPOSAL')],
  turns: [{ message: 'No Fridays please' }],
  check: ({ turns }) => {
    assertChipsOnly(turns);
  },
};

/**
 * The scenarios of one T06 dimension.
 *
 * @returns The scenarios.
 */
export function intentScenarios(): readonly Scenario[] {
  return [
    intentHardWordingBecomesAPreferredChip,
    intentPreferredWordingBecomesAPreferredChip,
    intentAnUnconfirmedProposalNeverReachesTheSolver,
    intentOnlyTheConfirmedFormStateIsScheduled,
    intentDemoModelProposesAChipForNoFridays,
  ];
}
