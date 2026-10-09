/**
 * @file Manual `eval:live` runner: the any-model T06 scenarios against the real Claude adapter.
 * The repo owner runs it by hand with `ANTHROPIC_API_KEY` and `CONVERSATION_MODEL=claude` set.
 * It is never called by `pnpm test`, `pnpm verify` or CI, and agents cannot run it (ADR-0003).
 * It prints a pass rate per dimension and exits 1 when a release-blocking scenario fails.
 * @module @caa/tests/support/eval-live
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 * @see docs/standards/07-testing.md
 */
import { createClaudeModelFromEnv } from '@caa/api/testing';
import type { ConversationModel } from '@caa/assistant';

import { createEvalRig } from './eval-harness';
import { runScenario, type Scenario } from './eval-runner';
import { anyModelScenarios } from './eval-scenarios/all';

/** One scenario's result. */
interface Result {
  readonly id: string;
  readonly dimension: string;
  readonly releaseBlocker: boolean;
  readonly error: string | null;
}

/**
 * Runs one scenario and records how it went.
 *
 * @param rig - The rig.
 * @param scenario - The scenario.
 * @param model - The live model.
 * @returns The result.
 */
async function runOne(
  rig: ReturnType<typeof createEvalRig>,
  scenario: Scenario,
  model: ConversationModel,
): Promise<Result> {
  let error: string | null = null;
  try {
    await runScenario(rig, scenario, model);
  } catch (caught) {
    error = caught instanceof Error ? (caught.message.split('\n')[0] ?? 'failed') : 'failed';
  }
  process.stdout.write(`${error === null ? 'pass' : 'FAIL'}  ${scenario.id}\n`);
  return {
    id: scenario.id,
    dimension: scenario.dimension,
    releaseBlocker: scenario.releaseBlocker,
    error,
  };
}

/**
 * Prints the pass rate of each dimension and each failed release blocker.
 *
 * @param results - Every result.
 * @returns The number of failed release blockers.
 */
function report(results: readonly Result[]): number {
  process.stdout.write('\nPass rate by dimension\n');
  for (const dimension of new Set(results.map((result) => result.dimension))) {
    const group = results.filter((result) => result.dimension === dimension);
    const passed = group.filter((result) => result.error === null).length;
    process.stdout.write(`  ${dimension}: ${String(passed)}/${String(group.length)}\n`);
  }
  const blockers = results.filter((result) => result.releaseBlocker && result.error !== null);
  for (const blocker of blockers) {
    process.stdout.write(`RELEASE BLOCKER  ${blocker.id}: ${blocker.error ?? ''}\n`);
  }
  return blockers.length;
}

/**
 * Runs every any-model scenario against the live model.
 *
 * @returns The exit code: 0 when no release-blocking scenario failed, 1 otherwise, 2 when the
 *   environment is not set up for a live run.
 */
async function main(): Promise<number> {
  const { ANTHROPIC_API_KEY: key, CONVERSATION_MODEL: mode } = process.env;
  if (key === undefined || key === '' || mode !== 'claude') {
    process.stderr.write(
      'eval:live needs ANTHROPIC_API_KEY and CONVERSATION_MODEL=claude. Nothing was run.\n',
    );
    return 2;
  }
  const model = createClaudeModelFromEnv(process.env);
  const rig = createEvalRig();
  const results: Result[] = [];
  for (const scenario of anyModelScenarios()) {
    results.push(await runOne(rig, scenario, model));
  }
  return report(results) === 0 ? 0 : 1;
}

process.exitCode = await main();
