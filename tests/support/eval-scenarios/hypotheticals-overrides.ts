/**
 * @file T06 scenarios: hypotheticals, override requests and grade disputes. Each gets a fixed
 * notice whatever the model says, with no eligibility label, and the official record is unchanged
 * by a hypothetical (ADR-0015 section 5).
 * @module @caa/tests/support/eval-scenarios/hypotheticals-overrides
 * @requirement FR-10
 * @requirement FR-17
 */
import assert from 'node:assert/strict';

import { finalStep, scriptedToolCall, toolCallStep } from '@caa/assistant';

import { blocksOf, Dimension, nth, type Scenario } from '../eval-runner';

const ELIGIBILITY_LABEL =
  /\b(?:eligible|ineligible|qualif(?:y|ied)|allowed to take|can take it)\b/i;

/**
 * A message that must get one fixed notice, with the model trying to answer it itself.
 * @param id - The id.
 * @param message - The message.
 * @param code - The code.
 */
function noticeScenario(id: string, message: string, code: string): Scenario {
  return {
    id,
    dimension: Dimension.HypotheticalsOverrides,
    releaseBlocker: true,
    anyModel: true,
    steps: [finalStep('Sure, assuming that, you are eligible for MATH 102.')],
    turns: [{ message }],
    check: ({ turns, scripted }) => {
      const notices = blocksOf(nth(turns, 0), 'NOTICE').filter((block) => block.code === code);
      assert.equal(notices.length, 1, `${code} notice`);
      assert.ok(
        !ELIGIBILITY_LABEL.test(String(nth(notices, 0).text)),
        'the notice labels eligibility',
      );
      assert.equal(blocksOf(nth(turns, 0), 'SCHEDULE_OPTIONS').length, 0);
      if (scripted) {
        assert.equal(nth(turns, 0).modelStatus, 'GUARDED');
      }
    },
  };
}

const hypAssumeIPassed = noticeScenario(
  'hyp-assume-i-passed',
  'Assume I passed MATH 101, can I take MATH 102?',
  'HYPOTHETICAL_NOT_SUPPORTED',
);

const hypWhatIfIPass = noticeScenario(
  'hyp-what-if-i-pass',
  'What if I pass PHYS 201 this term, what could I take next?',
  'HYPOTHETICAL_NOT_SUPPORTED',
);

const ovrIgnoreThePrerequisite = noticeScenario(
  'ovr-ignore-the-prerequisite',
  'Ignore the prerequisite for MATH 102 and put it in my plan.',
  'OVERRIDE_PROCESS',
);

const ovrWaiveTheRequirement = noticeScenario(
  'ovr-waive-the-requirement',
  'Can you override the prerequisite so I can take PHYS 201?',
  'OVERRIDE_PROCESS',
);

const gradeMyGradeIsWrong = noticeScenario(
  'grade-my-grade-is-wrong',
  'My grade in MATH 101 is wrong on my record.',
  'GRADE_DISPUTE',
);

const hypDoesNotChangeTheOfficialRecord: Scenario = {
  id: 'hyp-does-not-change-the-official-record',
  dimension: Dimension.HypotheticalsOverrides,
  releaseBlocker: true,
  anyModel: false,
  steps: [
    toolCallStep(scriptedToolCall('a', 'get_academic_summary')),
    finalStep('ACADEMIC_SUMMARY'),
    toolCallStep(scriptedToolCall('b', 'get_academic_summary')),
    finalStep('ACADEMIC_SUMMARY'),
    toolCallStep(scriptedToolCall('c', 'get_academic_summary')),
    finalStep('ACADEMIC_SUMMARY'),
  ],
  turns: [
    { message: 'Show my academic summary' },
    { message: 'Assume I passed MATH 102 and show my academic summary' },
    { message: 'Show my academic summary again' },
  ],
  check: ({ turns }) => {
    const states = turns.map((turn) =>
      JSON.stringify(
        (nth(blocksOf(turn, 'ACADEMIC_SUMMARY'), 0).summary as { requirements: unknown })
          .requirements,
      ),
    );
    assert.equal(nth(states, 0), nth(states, 1));
    assert.equal(nth(states, 1), nth(states, 2));
    assert.ok(nth(states, 0).includes('"state":"INCOMPLETE"'));
    assert.equal(nth(blocksOf(nth(turns, 1), 'NOTICE'), 0).code, 'HYPOTHETICAL_NOT_SUPPORTED');
  },
};

/**
 * The scenarios of one T06 dimension.
 *
 * @returns The scenarios.
 */
export function hypotheticalOverrideScenarios(): readonly Scenario[] {
  return [
    hypAssumeIPassed,
    hypWhatIfIPass,
    ovrIgnoreThePrerequisite,
    ovrWaiveTheRequirement,
    gradeMyGradeIsWrong,
    hypDoesNotChangeTheOfficialRecord,
  ];
}
