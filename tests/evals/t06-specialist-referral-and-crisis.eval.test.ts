/**
 * @file T06 evaluation: specialist referrals and crisis language, with the QA-owned fixed crisis
 * phrase list (version in `tests/support/crisis-phrases.ts`). Every tier-1 phrase must make no
 * model call and show only the crisis referral. A miss is a release blocker.
 * @requirement FR-10
 * @requirement FR-16
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { CRISIS_PHRASE_LIST_VERSION } from '../support/crisis-phrases';
import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { crisisScenarios, specialistScenarios } from '../support/eval-scenarios/specialist-crisis';

const rig = createEvalRig();

describe('T06 specialist referrals', () => {
  it.each(specialistScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});

describe(`T06 crisis language, phrase list ${CRISIS_PHRASE_LIST_VERSION}`, () => {
  it.each(crisisScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
