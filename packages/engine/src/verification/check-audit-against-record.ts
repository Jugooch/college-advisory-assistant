/**
 * @file Decides whether audit-derived checks may read the audit for the pinned student record.
 * @module @caa/engine/verification/check-audit-against-record
 * @requirement FR-04
 * @requirement FR-05
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { type AuditSnapshot, CheckState } from '@caa/domain';

import {
  type AuditProgramConsistency,
  checkAuditProgramAndCatalog,
} from './check-audit-program-and-catalog';
import {
  type AuditRecordReflection,
  checkAuditReflectsRecord,
  type PinnedStudentRecord,
  type StudentRecordFreshness,
} from './check-audit-reflects-record';

/** PASS when the audit may be read for the record; otherwise the first reason it may not. */
export type AuditRecordAgreement = AuditRecordReflection | AuditProgramConsistency;

/**
 * Checks that the audit reflects the pinned record (`checkAuditReflectsRecord`) and then that
 * it is for the record's program and catalog (`checkAuditProgramAndCatalog`). The first check
 * that isn't PASS decides.
 *
 * @param audit - The audit snapshot.
 * @param record - The pinned student record and maximum skew, or (transitional, tests only) the
 *   record time and skew, which skip the identity, revision, and program checks.
 * @returns PASS, or UNKNOWN with `AUDIT_STALE`, `AUDIT_AMBIGUOUS`, or `AUDIT_PROGRAM_MISMATCH`.
 * @throws {AuditRecordInputError} When a timestamp or the maximum skew is invalid.
 */
export function checkAuditAgainstRecord(
  audit: AuditSnapshot,
  record: PinnedStudentRecord | StudentRecordFreshness,
): AuditRecordAgreement {
  // TODO(#122): drop the time-only form once no caller passes StudentRecordFreshness.
  if (!('studentSnapshot' in record)) {
    return checkAuditReflectsRecord(audit, record.studentRecordEffectiveAt, record.maxSkewMs);
  }
  const reflection = checkAuditReflectsRecord(audit, record.studentSnapshot, record.maxSkewMs);
  // SAFETY: an audit that doesn't reflect the record is reported as such first: which program
  // it describes matters only once it is known to be about this record (planning/07
  // §Consistency model; AC10).
  if (reflection.state !== CheckState.Pass) {
    return reflection;
  }
  return checkAuditProgramAndCatalog(record.studentSnapshot, audit);
}
