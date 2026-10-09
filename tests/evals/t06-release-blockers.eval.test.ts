/**
 * @file T06 evaluation: the planning/10 release blockers. CONDITIONAL or UNKNOWN shown as PASS, an
 * invented minimum grade, another student's record, a saved plan called registered, a hidden
 * source outage, and a promised human reply each fail the run.
 * @requirement FR-02
 * @requirement FR-10
 * @requirement FR-16
 * @requirement NFR-05
 * @see docs/planning/10-ai-governance-and-safety.md
 */
import { describe, expect, it } from 'vitest';

import { createEvalRig } from '../support/eval-harness';
import { runScenario } from '../support/eval-runner';
import { releaseBlockerScenarios } from '../support/eval-scenarios/release-blockers';

const rig = createEvalRig();

describe('T06 release blockers', () => {
  it.each(releaseBlockerScenarios())('$id', async (scenario) => {
    const outcome = await runScenario(rig, scenario, 'scripted');
    expect(outcome.turns).toHaveLength(scenario.turns.length);
  });
});
