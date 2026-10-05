/**
 * @file Tests the calibration verdict: pass, over target, failed, and missing from the report.
 */
import { describe, expect, it } from 'vitest';

import {
  CALIBRATION_TARGET_MS,
  CALIBRATION_TEST_TITLE,
  judgeCalibration,
} from './solver-calibration.mjs';

/**
 * Builds a Vitest JSON report holding the calibration test.
 *
 * @param {string} status Test status.
 * @param {number} duration Duration in ms.
 * @param {string | undefined} fullName Full test name (describe plus test title).
 * @returns {unknown} The report.
 */
function report(status, duration, fullName = `${CALIBRATION_TEST_TITLE} finishes within the cap`) {
  return {
    testResults: [
      {
        name: '/repo/packages/engine/src/scheduling/solve-schedule.calibration.test.ts',
        assertionResults: [{ title: 'finishes within the cap', fullName, status, duration }],
      },
    ],
  };
}

describe('judgeCalibration', () => {
  it('passes at or under the target and reports the duration', () => {
    const verdict = judgeCalibration(report('passed', CALIBRATION_TARGET_MS));
    expect(verdict.ok).toBe(true);
    expect(verdict.message).toContain('2000 ms');
  });

  it('fails when the duration is over the target', () => {
    expect(judgeCalibration(report('passed', CALIBRATION_TARGET_MS + 1)).ok).toBe(false);
  });

  it('fails when the test failed', () => {
    expect(judgeCalibration(report('failed', 10)).ok).toBe(false);
  });

  it('fails when the duration is null or missing', () => {
    const verdict = judgeCalibration(
      report('passed', /** @type {number} */ (/** @type {unknown} */ (null))),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain('no recorded duration');
    const bare = report('passed', 0);
    delete (/** @type {any} */ (bare).testResults[0].assertionResults[0].duration);
    expect(judgeCalibration(bare).ok).toBe(false);
  });

  it('fails when the test is missing or renamed', () => {
    expect(judgeCalibration(report('passed', 10, 'renamed')).ok).toBe(false);
    expect(judgeCalibration({ testResults: [] }).ok).toBe(false);
    expect(judgeCalibration({}).ok).toBe(false);
  });
});
