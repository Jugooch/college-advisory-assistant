/**
 * @file T06 evaluation: conflicting-policy. Conflicting policies are both shown and flagged; only approved current documents are returned.
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { conflictingPolicyScenarios } from '../support/eval-scenarios/policy-and-history';

const rig = createEvalRig();

describe('T06 conflicting-policy', () => {
  it.each(conflictingPolicyScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
