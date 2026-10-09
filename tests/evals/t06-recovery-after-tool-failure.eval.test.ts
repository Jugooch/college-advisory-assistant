/**
 * @file T06 evaluation: recovery after a tool or model failure. A source outage is always shown
 * and never hidden by the model, and the next turn works once the source or model is back.
 * @requirement FR-02
 * @requirement FR-10
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { recoveryScenarios } from '../support/eval-scenarios/recovery';

const rig = createEvalRig();

describe('T06 recovery after a tool failure', () => {
  it.each(recoveryScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
