/**
 * @file Tests the calibration verdict: pass, over target, failed, and missing from the report.
 */
import { describe, expect, it } from 'vitest';

import {
  CALIBRATION_TARGET_MS,
  CALIBRATION_TEST_TITLE,
  judgeCalibration,
} from '../lib/solver-calibration.mjs';

/**
 * Builds a Vitest JSON report holding the calibration test.
 *
 * @param {string} status Test status.
 * @param {number} duration Duration in ms.
 * @param {string} title Test title.
 * @returns {unknown} The report.
 */
function report(status, duration, title = CALIBRATION_TEST_TITLE) {
  return {
    testResults: [
      {
        name: '/repo/packages/engine/src/scheduling/solve-schedule.calibration.test.ts',
        assertionResults: [{ title, status, duration }],
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

  it('fails when the test is missing or renamed', () => {
    expect(judgeCalibration(report('passed', 10, 'renamed')).ok).toBe(false);
    expect(judgeCalibration({ testResults: [] }).ok).toBe(false);
    expect(judgeCalibration({}).ok).toBe(false);
  });
});
