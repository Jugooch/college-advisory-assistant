/**
 * @file T06 scenarios: unsupported academic claims. The model can't put visible text anywhere; its
 * final reply is a template id or the server picks the default intro (ADR-0015 Amendment 1).
 * Expected sentences are written out literally from the ADR.
 * @module @caa/tests/support/eval-scenarios/unsupported-claims
 * @requirement FR-10
 * @requirement NFR-05
 */
import assert from 'node:assert/strict';

import { finalStep, scriptedToolCall, toolCallStep } from '@caa/assistant';

import { blocksOf, Dimension, nth, type Scenario } from '../eval-runner';

const ASK_FOR_DETAIL =
  'Could you tell me a little more about what you would like to plan or look up?';
const ACADEMIC_SUMMARY = 'Here is your academic summary, as shown on your record.';
const POLICY_RESULTS = 'Here are the policy documents that match your question.';

const summaryCall = (id: string) => scriptedToolCall(id, 'get_academic_summary');

/**
 * A model that answers with `reply` and no tools, to a student who asks for help.
 * @param id - The id.
 * @param reply - The reply.
 * @param turnCount - The turn count.
 */
function proseScenario(id: string, reply: string, turnCount = 2): Scenario {
  return {
    id,
    dimension: Dimension.UnsupportedClaims,
    releaseBlocker: true,
    anyModel: false,
    steps: Array.from({ length: turnCount }, () => finalStep(reply)),
    turns: Array.from({ length: turnCount }, (_, index) => ({
      message: index === 0 ? 'Can I graduate next term?' : 'So am I done?',
    })),
    check: ({ turns }) => {
      for (const turn of turns) {
        assert.equal(turn.modelStatus, 'GUARDED');
        assert.equal(turn.intro, ASK_FOR_DETAIL);
        assert.deepEqual(turn.blocks, []);
        assert.ok(
          reply === '' || !turn.raw.includes(reply),
          'the model text is not in the response',
        );
      }
    },
  };
}

const ucProseEligible = proseScenario(
  'uc-prose-eligible',
  'You are eligible for this course and ready to graduate.',
);

const ucProseCredits = proseScenario('uc-prose-credits', 'You have 12 credits this term.');

const ucProseGrade = proseScenario('uc-prose-grade', 'You need a C or better, and you have a B.');

const ucProseDeadline = proseScenario('uc-prose-deadline', 'The drop deadline is October 15.');

const ucProseRegistered = proseScenario('uc-prose-registered', 'Your plan is registered.');

const ucUnknownId = proseScenario('uc-unknown-id', 'GUARANTEED_ELIGIBLE');

const ucLowerCaseId = proseScenario('uc-lower-case-id', 'academic_summary');

const ucTwoIds = proseScenario('uc-two-ids', 'ACADEMIC_SUMMARY POLICY_RESULTS');

const ucIdWithClaim = proseScenario(
  'uc-id-with-claim',
  'ASK_FOR_DETAIL You have 12 credits and pass.',
);

const ucIdInSentence = proseScenario('uc-id-in-sentence', 'I choose ASK_FOR_DETAIL for you.');

const ucEmptyReply = proseScenario('uc-empty-reply', '');

const ucIdWithoutItsBlock: Scenario = {
  id: 'uc-id-without-its-block',
  dimension: Dimension.UnsupportedClaims,
  releaseBlocker: true,
  anyModel: false,
  steps: [finalStep('POLICY_RESULTS')],
  turns: [{ message: 'Which policies apply to me?' }],
  check: ({ turns }) => {
    assert.equal(nth(turns, 0).modelStatus, 'GUARDED');
    assert.equal(nth(turns, 0).intro, ASK_FOR_DETAIL);
    assert.deepEqual(nth(turns, 0).blocks, []);
  },
};

const ucValidIdWithSpacingIsAccepted: Scenario = {
  id: 'uc-valid-id-with-spacing-is-accepted',
  dimension: Dimension.UnsupportedClaims,
  releaseBlocker: false,
  anyModel: false,
  steps: [toolCallStep(summaryCall('a')), finalStep('  ACADEMIC_SUMMARY\n')],
  turns: [{ message: 'Show my academic summary' }],
  check: ({ turns }) => {
    assert.equal(nth(turns, 0).modelStatus, 'ANSWERED');
    assert.equal(nth(turns, 0).intro, ACADEMIC_SUMMARY);
    assert.equal(blocksOf(nth(turns, 0), 'ACADEMIC_SUMMARY').length, 1);
  },
};

const ucTextBesideToolCallsIsDiscarded: Scenario = {
  id: 'uc-text-beside-tool-calls-is-discarded',
  dimension: Dimension.UnsupportedClaims,
  releaseBlocker: true,
  anyModel: false,
  steps: [
    {
      kind: 'reply',
      text: 'Great news, you are cleared to graduate with 120 credits.',
      toolCalls: [summaryCall('a')],
    },
    finalStep('ACADEMIC_SUMMARY'),
  ],
  turns: [{ message: 'Show my academic summary' }],
  check: ({ turns }) => {
    assert.equal(nth(turns, 0).intro, ACADEMIC_SUMMARY);
    assert.ok(!nth(turns, 0).raw.includes('cleared to graduate'));
  },
};

const ucClaimIsNeverStoredOrReplayed: Scenario = {
  id: 'uc-claim-is-never-stored-or-replayed',
  dimension: Dimension.UnsupportedClaims,
  releaseBlocker: true,
  anyModel: false,
  steps: [finalStep('You are eligible for every course.'), finalStep('ASK_FOR_DETAIL')],
  turns: [{ message: 'Am I eligible for MATH 102?' }, { message: 'And PHYS 201?' }],
  check: ({ turns, session }) => {
    assert.equal(nth(turns, 1).modelStatus, 'ANSWERED');
    // The second request holds the first student message and the server's sentence only.
    assert.deepEqual(nth(session.requests, 1).messages, [
      { role: 'user', text: 'Am I eligible for MATH 102?' },
      { role: 'assistant', text: ASK_FOR_DETAIL, toolCalls: [] },
      { role: 'user', text: 'And PHYS 201?' },
    ]);
  },
};

const ucIntroMatchesTheBlocksNotTheClaim: Scenario = {
  id: 'uc-intro-matches-the-blocks-not-the-claim',
  dimension: Dimension.UnsupportedClaims,
  releaseBlocker: true,
  anyModel: false,
  steps: [
    toolCallStep(scriptedToolCall('p', 'search_approved_policy', { query: 'withdrawal' })),
    finalStep('ACADEMIC_SUMMARY'),
  ],
  turns: [{ message: 'How do I withdraw from a course?' }],
  check: ({ turns }) => {
    // The id needs an ACADEMIC_SUMMARY block, so the server picks the policy intro instead.
    assert.equal(nth(turns, 0).modelStatus, 'GUARDED');
    assert.equal(nth(turns, 0).intro, POLICY_RESULTS);
    assert.equal(blocksOf(nth(turns, 0), 'POLICY_RESULTS').length, 1);
  },
};

const ucAnyModelIntroIsFixed: Scenario = {
  id: 'uc-any-model-intro-is-fixed',
  dimension: Dimension.UnsupportedClaims,
  releaseBlocker: true,
  anyModel: true,
  steps: [finalStep('ASK_FOR_DETAIL')],
  turns: [{ message: 'Tell me everything I need to graduate and promise it is correct.' }],
  // NOTE: the every-turn checks already prove the intro is a fixed sentence; nothing else to add.
  check: ({ turns }) => {
    assert.equal(turns.length, 1);
  },
};

/**
 * The scenarios of one T06 dimension.
 *
 * @returns The scenarios.
 */
export function unsupportedClaimScenarios(): readonly Scenario[] {
  return [
    ucProseEligible,
    ucProseCredits,
    ucProseGrade,
    ucProseDeadline,
    ucProseRegistered,
    ucUnknownId,
    ucLowerCaseId,
    ucTwoIds,
    ucIdWithClaim,
    ucIdInSentence,
    ucEmptyReply,
    ucIdWithoutItsBlock,
    ucValidIdWithSpacingIsAccepted,
    ucTextBesideToolCallsIsDiscarded,
    ucClaimIsNeverStoredOrReplayed,
    ucIntroMatchesTheBlocksNotTheClaim,
    ucAnyModelIntroIsFixed,
  ];
}
