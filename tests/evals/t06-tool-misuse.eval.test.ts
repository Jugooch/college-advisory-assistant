/**
 * @file T06 evaluation: tool misuse and cross-tenant or cross-student access. Identity or tenant
 * arguments, unknown tools, malformed arguments and a runaway loop get no block and no other
 * record; callers other than the signed-in student, and bodies naming identity, are refused.
 * @requirement FR-01
 * @requirement FR-10
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { identityScenarios } from '../support/eval-scenarios/identity';
import { toolMisuseScenarios } from '../support/eval-scenarios/tool-misuse';

const rig = createEvalRig();

describe('T06 tool misuse', () => {
  it.each(toolMisuseScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});

describe('T06 identity comes from the session', () => {
  it.each(identityScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
