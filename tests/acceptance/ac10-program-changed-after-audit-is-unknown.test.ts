/**
 * @file Acceptance: when the SIS record changed after the audit was generated, beyond the allowed
 *   skew, checks read from the audit are UNKNOWN; no mixed-snapshot validation.
 * @requirement FR-04
 * @requirement NFR-04
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, ReasonCode } from '@caa/domain';
import { checkAllocation, checkAuditReflectsRecord, evaluateApplicability } from '@caa/engine';
import { auditWith, planned, SYNTHETIC_COURSES } from '@caa/test-kit';

/** The record changed 90 minutes after the audit's record (07:30-05:00); 60 are allowed. */
const CHANGED_RECORD = {
  studentRecordEffectiveAt: '2026-09-20T09:00:00.000-05:00',
  maxSkewMs: 3_600_000,
};
const AUDIT = auditWith({});

describe('AC10 a program changed after the audit is never validated from the old audit', () => {
  it('reports the audit as stale', () => {
    const reflection = checkAuditReflectsRecord(
      AUDIT,
      CHANGED_RECORD.studentRecordEffectiveAt,
      CHANGED_RECORD.maxSkewMs,
    );

    expect(reflection).toEqual({ state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale });
  });

  it('makes applicability UNKNOWN AUDIT_STALE although the audit lists the course', () => {
    const check = evaluateApplicability(SYNTHETIC_COURSES.math102.id, AUDIT, CHANGED_RECORD);

    expect(check).toMatchObject({ state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale });
  });

  it('makes allocation UNKNOWN AUDIT_STALE', () => {
    const checks = checkAllocation([planned(SYNTHETIC_COURSES.math102)], AUDIT, CHANGED_RECORD);

    expect(checks).toMatchObject([
      { state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale },
    ]);
  });
});
