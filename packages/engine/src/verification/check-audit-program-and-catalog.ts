/**
 * @file Decides whether a degree audit is for the program and catalog in the pinned student record.
 * @module @caa/engine/verification/check-audit-program-and-catalog
 * @requirement FR-04
 * @requirement FR-05
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import {
  type AuditSnapshot,
  CheckState,
  isSameProgramAndCatalog,
  ReasonCode,
  type StudentSnapshot,
} from '@caa/domain';

/** Whether the audit is for the record's program and catalog, with the same shape as the summary contract. */
export type AuditProgramConsistency =
  | { readonly state: typeof CheckState.Pass; readonly reasonCode: null }
  | {
      readonly state: typeof CheckState.Unknown;
      readonly reasonCode: typeof ReasonCode.AuditProgramMismatch;
    };

const CONSISTENT: AuditProgramConsistency = { state: CheckState.Pass, reasonCode: null };
const PROGRAM_MISMATCH: AuditProgramConsistency = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.AuditProgramMismatch,
};

/**
 * Checks that the pinned student record states a program and catalog and that both are the
 * audit's. The rule is the shared invariant `isSameProgramAndCatalog` (ADR-0005); this check
 * only maps its answer to a check state.
 *
 * @param record - The pinned student snapshot; its program and catalog may be `null`.
 * @param audit - The audit snapshot.
 * @returns PASS when they match, otherwise UNKNOWN (`AUDIT_PROGRAM_MISMATCH`), never FAIL: only
 *   the audit and the SIS can say which program is current.
 */
export function checkAuditProgramAndCatalog(
  record: StudentSnapshot,
  audit: AuditSnapshot,
): AuditProgramConsistency {
  // SAFETY: an audit for another program or catalog, or a record that doesn't say which it
  // follows, is conflicting or missing data, so it is UNKNOWN and never a PASS (planning/09
  // §Source authority matrix: block the affected claim if contradictory; planning/08
  // §Authority and result semantics: missing or conflicting data is UNKNOWN).
  return isSameProgramAndCatalog(record, audit) ? CONSISTENT : PROGRAM_MISMATCH;
}
