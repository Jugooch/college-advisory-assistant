/**
 * @file Fails when the solver calibration test is missing, failed, or slower than ADR-0010 §1
 * allows. Usage: `node scripts/check-solver-calibration.mjs <vitest-json-report>`. Prints the
 * duration and appends it to `$GITHUB_STEP_SUMMARY` when set.
 * @module scripts/check-solver-calibration
 * @see docs/planning/07-deployment-and-delivery.md
 */
import { appendFileSync, readFileSync } from 'node:fs';

import { judgeCalibration } from './lib/solver-calibration.mjs';

const reportPath = process.argv[2];
if (reportPath === undefined) {
  console.error('Usage: node scripts/check-solver-calibration.mjs <vitest-json-report>');
  process.exit(1);
}

const verdict = judgeCalibration(JSON.parse(readFileSync(reportPath, 'utf8')));
console.log(verdict.message);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Solver calibration (ADR-0010 §1)\n\n${verdict.message}\n`,
  );
}
process.exit(verdict.ok ? 0 : 1);
