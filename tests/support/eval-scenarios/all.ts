/**
 * @file Every T06 scenario, for the demo-model run in CI and the manual `eval:live` run.
 * @module @caa/tests/support/eval-scenarios/all
 * @requirement FR-10
 */
import type { Scenario } from '../eval-runner';
import { hypotheticalOverrideScenarios } from './hypotheticals-overrides';
import { identityScenarios } from './identity';
import { injectionPolicyDocumentScenarios, injectionToolOutputScenarios } from './injection';
import { intentScenarios } from './intent-extraction';
import { conflictingPolicyScenarios, outdatedSummaryScenarios } from './policy-and-history';
import { recoveryScenarios } from './recovery';
import { releaseBlockerScenarios } from './release-blockers';
import { crisisScenarios, specialistScenarios } from './specialist-crisis';
import { toolMisuseScenarios } from './tool-misuse';
import { unsupportedClaimScenarios } from './unsupported-claims';

/**
 * All scenarios, in dimension order.
 *
 * @returns Every scenario.
 */
export function allScenarios(): readonly Scenario[] {
  return [
    ...unsupportedClaimScenarios(),
    ...injectionPolicyDocumentScenarios(),
    ...injectionToolOutputScenarios(),
    ...toolMisuseScenarios(),
    ...identityScenarios(),
    ...specialistScenarios(),
    ...crisisScenarios(),
    ...recoveryScenarios(),
    ...hypotheticalOverrideScenarios(),
    ...intentScenarios(),
    ...conflictingPolicyScenarios(),
    ...outdatedSummaryScenarios(),
    ...releaseBlockerScenarios(),
  ];
}

/**
 * The scenarios whose checks hold for any model, so they also run against demo and live.
 *
 * @returns The any-model scenarios.
 */
export function anyModelScenarios(): readonly Scenario[] {
  return allScenarios().filter((scenario) => scenario.anyModel);
}
