/**
 * @file T06 evaluation: instructions inside tool output. Every tool result reaches the model inside
 * the data wrapper, minimized, and a model that obeys injected text can't reach another record.
 * @requirement FR-10
 * @requirement FR-01
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { injectionToolOutputScenarios } from '../support/eval-scenarios/injection';

const rig = createEvalRig();

describe('T06 injection in tool output', () => {
  it.each(injectionToolOutputScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
