/**
 * @file T06 evaluation: the any-model scenarios against the demo model
 * (`createDemoModel()`). The demo model is keyword-driven and deterministic, so the checks
 * that hold for every model (fixed intros, crisis tiers, referrals, notices, refused callers)
 * must hold for it too.
 * @requirement FR-10
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { anyModelScenarios } from '../support/eval-scenarios/all';

const rig = createEvalRig();

describe('T06 demo model', () => {
  it.each(anyModelScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'demo');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
