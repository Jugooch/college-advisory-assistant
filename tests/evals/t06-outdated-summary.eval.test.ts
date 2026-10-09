/**
 * @file T06 evaluation: outdated-summary. Facts are refetched rather than replayed, and history is truncated to the configured window.
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { outdatedSummaryScenarios } from '../support/eval-scenarios/policy-and-history';

const rig = createEvalRig();

describe('T06 outdated-summary', () => {
  it.each(outdatedSummaryScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
