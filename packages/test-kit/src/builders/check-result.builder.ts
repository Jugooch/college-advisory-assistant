/**
 * @file Builds synthetic check results for tests.
 * @module @caa/test-kit/builders/check-result
 */
import {
  CheckKind,
  type CheckResult,
  type CheckResultInput,
  CheckState,
  createCheckResult,
} from '@caa/domain';

/**
 * Builds a valid check result, defaulting to a passing prerequisite check.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated check result.
 */
export function buildCheckResult(overrides: Partial<CheckResultInput> = {}): CheckResult {
  return createCheckResult({
    kind: CheckKind.Prerequisite,
    state: CheckState.Pass,
    ...overrides,
  });
}
