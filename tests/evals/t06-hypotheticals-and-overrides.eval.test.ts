/**
 * @file T06 evaluation: hypotheticals, override requests and grade disputes. The notice is fixed,
 * labels no eligibility, and a hypothetical never changes what the official record shows.
 * @requirement FR-10
 * @requirement FR-17
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { hypotheticalOverrideScenarios } from '../support/eval-scenarios/hypotheticals-overrides';

const rig = createEvalRig();

describe('T06 hypotheticals and overrides', () => {
  it.each(hypotheticalOverrideScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
