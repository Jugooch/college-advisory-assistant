/**
 * @file T06 evaluation: prompt injection inside a policy document and in the student's message.
 * The corpus holds an approved document that tells the model to ignore its instructions; it is
 * data, inside the wrapper, and a model that obeys it still can't show its own text.
 * @requirement FR-10
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { injectionPolicyDocumentScenarios } from '../support/eval-scenarios/injection';

const rig = createEvalRig();

describe('T06 injection in a policy document', () => {
  it.each(injectionPolicyDocumentScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
