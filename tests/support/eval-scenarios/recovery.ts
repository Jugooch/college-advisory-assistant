/**
 * @file T06 scenarios: recovery after a tool or model failure. A failed source read always shows
 * its notice and is never hidden; a model outage gives the fallback template; and the next turn
 * works once the source or model is back (ADR-0015 sections 2 and 4, planning/10).
 * @module @caa/tests/support/eval-scenarios/recovery
 * @requirement FR-02
 * @requirement FR-10
 * @requirement NFR-05
 */
import assert from 'node:assert/strict';

import { failureStep, finalStep, scriptedToolCall, toolCallStep } from '@caa/assistant';

import { recordSnapshot, resetAcademicWorld } from '../academic-endpoints-harness';
import { blocksOf, Dimension, nth, type Scenario } from '../eval-runner';

const summary = (id: string) => toolCallStep(scriptedToolCall(id, 'get_academic_summary'));
const ACADEMIC_SUMMARY = 'Here is your academic summary, as shown on your record.';
const ASK_FOR_DETAIL =
  'Could you tell me a little more about what you would like to plan or look up?';

const recSourceOutageShowsItsNoticeThenRecovers: Scenario = {
  id: 'rec-source-outage-shows-its-notice-then-recovers',
  dimension: Dimension.ToolFailureRecovery,
  releaseBlocker: true,
  anyModel: false,
  steps: [summary('a'), finalStep('ASK_FOR_DETAIL'), summary('b'), finalStep('ACADEMIC_SUMMARY')],
  turns: [
    {
      message: 'Show my academic summary',
      before: (world) => {
        world.studentSnapshots = [];
      },
    },
    {
      message: 'Try my academic summary again',
      before: (world) => {
        resetAcademicWorld(world);
      },
    },
  ],
  check: ({ turns }) => {
    const down = nth(turns, 0);
    const up = nth(turns, 1);
    assert.equal(blocksOf(down, 'ACADEMIC_SUMMARY').length, 0);
    assert.deepEqual(
      blocksOf(down, 'NOTICE').map((block) => block.code),
      ['SOURCE_UNAVAILABLE'],
    );
    assert.equal(down.intro, ASK_FOR_DETAIL);
    assert.equal(up.modelStatus, 'ANSWERED');
    assert.equal(up.intro, ACADEMIC_SUMMARY);
    assert.equal(blocksOf(up, 'NOTICE').length, 0);
    assert.equal(blocksOf(up, 'ACADEMIC_SUMMARY').length, 1);
  },
};

const recStaleRecordShowsItsNoticeAndNoSummary: Scenario = {
  id: 'rec-stale-record-shows-its-notice-and-no-summary',
  dimension: Dimension.ToolFailureRecovery,
  releaseBlocker: true,
  anyModel: false,
  steps: [summary('a'), finalStep('ASK_FOR_DETAIL')],
  turns: [
    {
      message: 'Show my academic summary',
      before: (world) => {
        // Three days before the clock, past the 24-hour maximum age.
        world.studentSnapshots = [
          recordSnapshot({
            sourceEffectiveAt: '2026-08-29T06:00:00.000Z',
            ingestedAt: '2026-08-29T06:30:00.000Z',
          }),
        ];
      },
    },
  ],
  check: ({ turns }) => {
    assert.equal(blocksOf(nth(turns, 0), 'ACADEMIC_SUMMARY').length, 0);
    assert.deepEqual(
      blocksOf(nth(turns, 0), 'NOTICE').map((block) => block.code),
      ['STALE_SOURCE'],
    );
  },
};

const recModelClaimingTheDataArrivedCannotHideTheOutage: Scenario = {
  id: 'rec-model-claiming-the-data-arrived-cannot-hide-the-outage',
  dimension: Dimension.ToolFailureRecovery,
  releaseBlocker: true,
  anyModel: false,
  steps: [summary('a'), finalStep('ACADEMIC_SUMMARY')],
  turns: [
    {
      message: 'Show my academic summary',
      before: (world) => {
        world.studentSnapshots = [];
      },
    },
  ],
  check: ({ turns }) => {
    // The id needs a summary block that doesn't exist, so the server chooses; the notice stays.
    assert.equal(nth(turns, 0).modelStatus, 'GUARDED');
    assert.equal(blocksOf(nth(turns, 0), 'ACADEMIC_SUMMARY').length, 0);
    assert.deepEqual(
      blocksOf(nth(turns, 0), 'NOTICE').map((block) => block.code),
      ['SOURCE_UNAVAILABLE'],
    );
  },
};

const recModelProseAfterAnOutageStillShowsTheNotice: Scenario = {
  id: 'rec-model-prose-after-an-outage-still-shows-the-notice',
  dimension: Dimension.ToolFailureRecovery,
  releaseBlocker: true,
  anyModel: false,
  steps: [summary('a'), finalStep('Your record loaded fine and everything is on track.')],
  turns: [
    {
      message: 'Show my academic summary',
      before: (world) => {
        world.studentSnapshots = [];
      },
    },
  ],
  check: ({ turns }) => {
    assert.equal(nth(turns, 0).modelStatus, 'GUARDED');
    assert.deepEqual(
      blocksOf(nth(turns, 0), 'NOTICE').map((block) => block.code),
      ['SOURCE_UNAVAILABLE'],
    );
    assert.ok(!nth(turns, 0).raw.includes('on track'));
  },
};

const recModelUnavailableGivesTheFallbackAndTheNextTurnWorks: Scenario = {
  id: 'rec-model-unavailable-gives-the-fallback-and-the-next-turn-works',
  dimension: Dimension.ToolFailureRecovery,
  releaseBlocker: false,
  anyModel: false,
  steps: [failureStep('unavailable'), finalStep('ASK_FOR_DETAIL')],
  turns: [{ message: 'What classes can I take?' }, { message: 'Hello again' }],
  check: ({ turns }) => {
    assert.equal(nth(turns, 0).modelStatus, 'MODEL_UNAVAILABLE');
    assert.deepEqual(
      blocksOf(nth(turns, 0), 'NOTICE').map((block) => block.code),
      ['MODEL_UNAVAILABLE'],
    );
    assert.equal(nth(turns, 0).sequence, 2);
    assert.equal(nth(turns, 1).modelStatus, 'ANSWERED');
    assert.equal(nth(turns, 1).sequence, 4);
  },
};

const recModelTimeoutGivesTheFallback: Scenario = {
  id: 'rec-model-timeout-gives-the-fallback',
  dimension: Dimension.ToolFailureRecovery,
  releaseBlocker: false,
  anyModel: false,
  steps: [failureStep('timeout')],
  turns: [{ message: 'What classes can I take?' }],
  check: ({ turns }) => {
    assert.equal(nth(turns, 0).modelStatus, 'MODEL_UNAVAILABLE');
    assert.equal(nth(blocksOf(nth(turns, 0), 'NOTICE'), 0).code, 'MODEL_UNAVAILABLE');
  },
};

const recModelFailsAfterAToolAndTheOutageNoticeStays: Scenario = {
  id: 'rec-model-fails-after-a-tool-and-the-outage-notice-stays',
  dimension: Dimension.ToolFailureRecovery,
  releaseBlocker: true,
  anyModel: false,
  steps: [summary('a'), failureStep('timeout')],
  turns: [
    {
      message: 'Show my academic summary',
      before: (world) => {
        world.studentSnapshots = [];
      },
    },
  ],
  check: ({ turns }) => {
    assert.equal(nth(turns, 0).modelStatus, 'MODEL_UNAVAILABLE');
    const codes = blocksOf(nth(turns, 0), 'NOTICE').map((block) => block.code);
    assert.ok(codes.includes('SOURCE_UNAVAILABLE'), 'the source outage is still shown');
    assert.ok(codes.includes('MODEL_UNAVAILABLE'));
  },
};

/**
 * The scenarios of one T06 dimension.
 *
 * @returns The scenarios.
 */
export function recoveryScenarios(): readonly Scenario[] {
  return [
    recSourceOutageShowsItsNoticeThenRecovers,
    recStaleRecordShowsItsNoticeAndNoSummary,
    recModelClaimingTheDataArrivedCannotHideTheOutage,
    recModelProseAfterAnOutageStillShowsTheNotice,
    recModelUnavailableGivesTheFallbackAndTheNextTurnWorks,
    recModelTimeoutGivesTheFallback,
    recModelFailsAfterAToolAndTheOutageNoticeStays,
  ];
}
