/**
 * @file T06 evaluation: unsupported academic claims. The model can't put visible text anywhere:
 * prose, ids with extra text, unknown ids and ids without their block all give the server's
 * default intro, and nothing the model wrote is shown, stored or replayed.
 * @requirement FR-10
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { unsupportedClaimScenarios } from '../support/eval-scenarios/unsupported-claims';

const rig = createEvalRig();

describe('T06 unsupported claims', () => {
  it.each(unsupportedClaimScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
