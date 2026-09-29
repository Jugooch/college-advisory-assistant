/**
 * @file Acceptance: when the SIS record changed the program after the audit was generated, checks
 *   read from the audit are UNKNOWN; no mixed-snapshot validation.
 * @requirement FR-04
 * @requirement NFR-04
 * @requirement AC10
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/07-system-architecture-and-design.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, ReasonCode } from '@caa/domain';
import {
  checkAllocation,
  checkAuditAgainstRecord,
  checkAuditReflectsRecord,
  evaluateApplicability,
} from '@caa/engine';
import {
  auditWith,
  buildStudentSnapshot,
  planned,
  SYNTHETIC_COURSES,
  syntheticId,
} from '@caa/test-kit';

const ONE_HOUR_MS = 3_600_000;
const PROGRAM_2 = syntheticId('program', 2);
/** Ran against snapshot 1 (program 1, record time 07:30-05:00) and lists DEMO-MATH 102. */
const AUDIT = auditWith({});
/** The SIS revised the record 90 minutes later (snapshot 2), moving the student to program 2. */
const CHANGED_RECORD = {
  studentSnapshot: buildStudentSnapshot(
    {
      programId: PROGRAM_2,
      sourceEffectiveAt: '2026-09-20T09:00:00.000-05:00',
      ingestedAt: '2026-09-20T09:05:00.000-05:00',
    },
    2,
  ),
  maxSkewMs: ONE_HOUR_MS,
};

describe('AC10 a program changed after the audit is never validated from the old audit', () => {
  it('reports the audit as stale for the later revision', () => {
    const reflection = checkAuditReflectsRecord(
      AUDIT,
      CHANGED_RECORD.studentSnapshot,
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

  it('is UNKNOWN when the revision changed the program at the same record time', () => {
    const sameTime = {
      studentSnapshot: buildStudentSnapshot({ programId: PROGRAM_2 }, 2),
      maxSkewMs: ONE_HOUR_MS,
    };

    const check = evaluateApplicability(SYNTHETIC_COURSES.math102.id, AUDIT, sameTime);

    expect(check.state).toBe(CheckState.Unknown);
  });

  it('is UNKNOWN AUDIT_PROGRAM_MISMATCH when the pinned record and the audit name different programs', () => {
    const agreement = checkAuditAgainstRecord(AUDIT, {
      studentSnapshot: buildStudentSnapshot({ programId: PROGRAM_2 }),
      maxSkewMs: ONE_HOUR_MS,
    });

    expect(agreement).toEqual({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.AuditProgramMismatch,
    });
  });
});
