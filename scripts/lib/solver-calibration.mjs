/**
 * @file Judges the solver calibration test from a Vitest JSON report (ADR-0010 §1, Amendment 3).
 * @module scripts/lib/solver-calibration
 * @see docs/planning/07-deployment-and-delivery.md
 */

/** Title of the calibration test; renaming it without updating this fails the check. */
export const CALIBRATION_TEST_TITLE =
  'finishes 8 courses × 6 bundles within the default cap: 2,015,538 attempts';

/** Target duration in ms for the default-cap solve, measured without coverage. */
export const CALIBRATION_TARGET_MS = 2000;

/**
 * Finds the calibration test in a Vitest JSON report and judges it.
 *
 * @param {unknown} report Parsed Vitest JSON report.
 * @returns {{ ok: boolean, message: string }} Verdict and a one-line message.
 */
export function judgeCalibration(report) {
  const files =
    /** @type {{ testResults?: Array<{ name?: string, assertionResults?: Array<{ title?: string, status?: string, duration?: number | null }> }> }} */ (
      report
    )?.testResults;
  const match = (files ?? [])
    .filter((file) => file.name?.endsWith('solve-schedule.calibration.test.ts'))
    .flatMap((file) => file.assertionResults ?? [])
    .find((test) => test.title === CALIBRATION_TEST_TITLE);
  if (match === undefined) {
    return {
      ok: false,
      message: `Calibration test not found in the report: "${CALIBRATION_TEST_TITLE}".`,
    };
  }
  if (match.status !== 'passed') {
    return { ok: false, message: `Calibration test did not pass (status: ${match.status}).` };
  }
  const duration = match.duration;
  if (typeof duration !== 'number') {
    return { ok: false, message: 'Calibration test has no recorded duration.' };
  }
  const rounded = Math.round(duration);
  if (duration > CALIBRATION_TARGET_MS) {
    return {
      ok: false,
      message: `Solver calibration took ${rounded} ms, over the ${CALIBRATION_TARGET_MS} ms target.`,
    };
  }
  return {
    ok: true,
    message: `Solver calibration took ${rounded} ms (target ${CALIBRATION_TARGET_MS} ms or less).`,
  };
}
