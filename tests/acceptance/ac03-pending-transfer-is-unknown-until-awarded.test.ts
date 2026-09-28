/**
 * @file Acceptance: a pending transfer course that could satisfy a prerequisite is UNKNOWN until
 *   approved credit exists, and earns no credit meanwhile.
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, CountingState, ReasonCode } from '@caa/domain';
import { resolveAttempts } from '@caa/engine';
import {
  buildAcademicPolicy,
  GOLDEN_CATALOG,
  GOLDEN_TERM_ORDER,
  letter,
  pendingTransferAttempt,
  transferAwardedAttempt,
} from '@caa/test-kit';

import { evaluateDefaultPrerequisite } from '../support/prerequisite-harness';

describe('AC03 pending transfer credit is not earned credit', () => {
  it('is UNKNOWN PENDING_TRANSFER while the evaluation is pending', () => {
    const check = evaluateDefaultPrerequisite({ attempts: [pendingTransferAttempt()] });

    expect(check).toMatchObject({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.PendingTransfer,
    });
  });

  it('earns no credit while pending', () => {
    const [group] = resolveAttempts([pendingTransferAttempt()], GOLDEN_CATALOG, {
      academicPolicy: buildAcademicPolicy(),
      termCodesOldestFirst: GOLDEN_TERM_ORDER,
    });

    expect(group?.counting).toEqual({ state: CountingState.None, earnedCreditsHundredths: 0 });
  });

  it('is PASS once the transfer is awarded with a B', () => {
    const check = evaluateDefaultPrerequisite({
      attempts: [transferAwardedAttempt({ grade: letter('B') })],
    });

    expect(check).toMatchObject({ state: CheckState.Pass });
    expect(check.reasonCode).toBeUndefined();
  });
});
