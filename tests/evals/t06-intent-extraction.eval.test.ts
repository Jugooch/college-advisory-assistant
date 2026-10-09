/**
 * @file T06 evaluation: intent-extraction. Hard and preferred wording becomes an unconfirmed PREFERRED chip, and only the confirmed form state is scheduled.
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { intentScenarios } from '../support/eval-scenarios/intent-extraction';

const rig = createEvalRig();

describe('T06 intent-extraction', () => {
  it.each(intentScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
