/**
 * @file T06 scenarios: conflicting policy, effective-date retrieval, and an outdated summary. Two
 * current documents that disagree are both shown, flagged; only approved, current, student-visible
 * documents of the tenant are returned; and history never replays facts.
 * @module @caa/tests/support/eval-scenarios/policy-and-history
 * @requirement FR-10
 * @requirement FR-16
 */
import assert from 'node:assert/strict';

import { finalStep, scriptedToolCall, toolCallStep } from '@caa/assistant';

import { recordAudit, resetAcademicWorld } from '../academic-endpoints-harness';
import { blocksOf, Dimension, nth, type Scenario } from '../eval-runner';
import { BOTH_COURSES } from '../plan-drafts-harness';

const ACADEMIC_SUMMARY = 'Here is your academic summary, as shown on your record.';

const polTwoCurrentDocumentsThatDisagreeAreBothShownFlagged: Scenario = {
  id: 'pol-two-current-documents-that-disagree-are-both-shown-flagged',
  dimension: Dimension.ConflictingPolicy,
  releaseBlocker: true,
  anyModel: false,
  steps: [
    toolCallStep(scriptedToolCall('a', 'search_approved_policy', { query: 'repeat' })),
    finalStep('You may repeat a course twice, so you are fine.'),
  ],
  turns: [{ message: 'How many times may I repeat a course?' }],
  check: ({ turns }) => {
    const results = nth(blocksOf(nth(turns, 0), 'POLICY_RESULTS'), 0).results as {
      hits: readonly { documentKey: string; revision: number; conflict: boolean }[];
    };
    assert.deepEqual(
      results.hits.map((hit) => [hit.documentKey, hit.revision, hit.conflict]).sort(),
      [
        ['repeat-limit-a', 1, true],
        ['repeat-limit-b', 1, true],
      ],
    );
    // The model's chosen number is never shown.
    assert.equal(nth(turns, 0).modelStatus, 'GUARDED');
    assert.ok(!nth(turns, 0).raw.includes('fine'));
  },
};

const polOnlyTheCurrentRevisionOfADocumentIsReturned: Scenario = {
  id: 'pol-only-the-current-revision-of-a-document-is-returned',
  dimension: Dimension.ConflictingPolicy,
  releaseBlocker: true,
  anyModel: false,
  steps: [
    toolCallStep(scriptedToolCall('a', 'search_approved_policy', { query: 'late registration' })),
    finalStep('POLICY_RESULTS'),
  ],
  turns: [{ message: 'What is the late registration rule?' }],
  check: ({ turns }) => {
    const results = nth(blocksOf(nth(turns, 0), 'POLICY_RESULTS'), 0).results as {
      hits: readonly { documentKey: string; revision: number; conflict: boolean }[];
    };
    // Revision 2 starts in January 2027, so at the clock only revision 1 applies.
    assert.deepEqual(
      results.hits.map((hit) => [hit.documentKey, hit.revision, hit.conflict]),
      [['late-registration', 1, false]],
    );
  },
};

const polDraftWithdrawnExpiredAdvisorAndOtherTenantDocumentsAreNeverReturned: Scenario = {
  id: 'pol-draft-withdrawn-expired-advisor-and-other-tenant-documents-are-never-returned',
  dimension: Dimension.ConflictingPolicy,
  releaseBlocker: true,
  anyModel: false,
  steps: [
    toolCallStep(
      scriptedToolCall('a', 'search_approved_policy', { query: 'parking permits' }),
      scriptedToolCall('b', 'search_approved_policy', { query: 'lab fee' }),
      scriptedToolCall('c', 'search_approved_policy', {
        query: 'advisors rotate review queue',
      }),
      scriptedToolCall('d', 'search_approved_policy', { query: 'summer housing' }),
    ),
    finalStep('POLICY_RESULTS'),
  ],
  turns: [{ message: 'Search parking, lab fees, advisor queues and summer housing' }],
  check: ({ turns }) => {
    for (const forbidden of [
      'draft-parking',
      'withdrawn-fees',
      'advisor-caseload',
      'other-tenant-parking',
      'summer-housing',
    ]) {
      assert.ok(!nth(turns, 0).raw.includes(forbidden), forbidden);
    }
    assert.ok(!nth(turns, 0).raw.includes('Sample Community College'));
  },
};

/**
 * The scenarios of one T06 dimension.
 *
 * @returns The scenarios.
 */
export function conflictingPolicyScenarios(): readonly Scenario[] {
  return [
    polTwoCurrentDocumentsThatDisagreeAreBothShownFlagged,
    polOnlyTheCurrentRevisionOfADocumentIsReturned,
    polDraftWithdrawnExpiredAdvisorAndOtherTenantDocumentsAreNeverReturned,
  ];
}

const outdatedFactsAreRefetchedNotReplayed: Scenario = {
  id: 'outdated-facts-are-refetched-not-replayed',
  dimension: Dimension.OutdatedSummary,
  releaseBlocker: true,
  anyModel: false,
  steps: [
    toolCallStep(scriptedToolCall('a', 'get_academic_summary')),
    finalStep('ACADEMIC_SUMMARY'),
    toolCallStep(scriptedToolCall('b', 'get_academic_summary')),
    finalStep('ACADEMIC_SUMMARY'),
  ],
  turns: [
    { message: 'Show my academic summary' },
    {
      message: 'Show it again, the audit was rerun',
      before: (world) => {
        resetAcademicWorld(world);
        world.audits = [
          recordAudit([
            { state: 'COMPLETE', remainingCreditsHundredths: 0, remainingCourseCount: 0 },
          ]),
        ];
      },
    },
  ],
  check: ({ turns, session }) => {
    const stateOf = (index: number) =>
      (
        nth(blocksOf(nth(turns, index), 'ACADEMIC_SUMMARY'), 0).summary as {
          requirements: readonly { state: string }[];
        }
      ).requirements.at(0)?.state;
    assert.equal(stateOf(0), 'INCOMPLETE');
    assert.equal(stateOf(1), 'COMPLETE');
    // The model's second request carries the first exchange as the student's words and the server's
    // sentence only, with no stored tool result or block.
    assert.deepEqual(nth(session.requests, 2).messages, [
      { role: 'user', text: 'Show my academic summary' },
      { role: 'assistant', text: ACADEMIC_SUMMARY, toolCalls: [] },
      { role: 'user', text: 'Show it again, the audit was rerun' },
    ]);
  },
};

const outdatedHistoryIsTruncatedToTheLastEightTurns: Scenario = {
  id: 'outdated-history-is-truncated-to-the-last-eight-turns',
  dimension: Dimension.OutdatedSummary,
  releaseBlocker: false,
  anyModel: false,
  steps: Array.from({ length: 6 }, () => finalStep('ASK_FOR_DETAIL')),
  turns: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'].map((message) => ({ message })),
  check: ({ session }) => {
    const last = nth(session.requests, 5).messages;
    // Eight stored turns are Q2, A, Q3, A, Q4, A, Q5, A; Q1 is gone; the new message follows.
    assert.equal(last.length, 9);
    assert.deepEqual(nth(last, 0), { role: 'user', text: 'Q2' });
    assert.deepEqual(nth(last, 8), { role: 'user', text: 'Q6' });
    assert.ok(!JSON.stringify(last).includes('"Q1"'));
  },
};

const outdatedTranscriptKeepsBlockReferencesNotResults: Scenario = {
  id: 'outdated-transcript-keeps-block-references-not-results',
  dimension: Dimension.OutdatedSummary,
  releaseBlocker: true,
  anyModel: false,
  plans: true,
  steps: [toolCallStep(scriptedToolCall('a', 'request_plan')), finalStep('SCHEDULE_OPTIONS')],
  turns: [{ message: 'Find my options', options: { plannerInputs: BOTH_COURSES } }],
  check: async ({ session }) => {
    const stored = await session.transcript();
    // A past schedule block is a reference with a time, never a result a reader could take as current.
    assert.ok(stored.includes('"kind":"SCHEDULE_OPTIONS"'));
    assert.ok(stored.includes('shownAt'));
    assert.ok(!stored.includes('"scheduleFeasibility"'));
    assert.ok(!stored.includes('"courseResults"'));
    assert.ok(!stored.includes('"PASS"'));
  },
};

/**
 * The scenarios of one T06 dimension.
 *
 * @returns The scenarios.
 */
export function outdatedSummaryScenarios(): readonly Scenario[] {
  return [
    outdatedFactsAreRefetchedNotReplayed,
    outdatedHistoryIsTruncatedToTheLastEightTurns,
    outdatedTranscriptKeepsBlockReferencesNotResults,
  ];
}
