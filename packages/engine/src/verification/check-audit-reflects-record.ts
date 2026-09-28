/**
 * @file Detects a degree audit older than the student record it must reflect, beyond the skew.
 * @module @caa/engine/verification/check-audit-reflects-record
 * @requirement FR-04
 * @requirement FR-09
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { type AuditSnapshot, CheckState, ReasonCode } from '@caa/domain';

/**
 * Whether the audit is not older than the student record beyond the skew. PASS says nothing
 * about the reverse direction. Anything short of PASS says why.
 */
export type AuditRecordReflection =
  | { readonly state: typeof CheckState.Pass; readonly reasonCode: null }
  | {
      readonly state: typeof CheckState.Unknown;
      readonly reasonCode: typeof ReasonCode.AuditStale;
    };

/** Inputs that say which student record the audit is compared with, and how much skew is allowed. */
export interface StudentRecordFreshness {
  /** When the student record the other checks read took effect. ISO 8601 with offset. */
  readonly studentRecordEffectiveAt: string;
  /**
   * The partner-specific maximum skew, in milliseconds, that the record may be newer than the
   * audit's record. A non-negative safe integer; there is no default.
   */
  readonly maxSkewMs: number;
}

/** Input fields whose values {@link checkAuditReflectsRecord} can reject. */
export type AuditRecordInputField =
  'audit.studentRecordEffectiveAt' | 'studentRecordEffectiveAt' | 'maxSkewMs';

/** Thrown when a timestamp or the maximum skew can't be compared. */
export class AuditRecordInputError extends Error {
  /**
   * Creates the error.
   *
   * @param field - The input that is invalid.
   */
  constructor(field: AuditRecordInputField) {
    super(`Audit record check input ${field} is invalid`);
    this.name = 'AuditRecordInputError';
  }
}

/** ISO 8601 with seconds and an explicit offset, the format the domain schemas accept. */
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const REFLECTS_RECORD: AuditRecordReflection = { state: CheckState.Pass, reasonCode: null };
const AUDIT_STALE: AuditRecordReflection = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.AuditStale,
};

/**
 * Checks that the audit is not older than the student record the other checks read, beyond the
 * allowed skew. The record may be newer than the audit's `studentRecordEffectiveAt` by at most
 * `maxSkewMs`: exactly `maxSkewMs` still passes, one millisecond more is stale.
 *
 * This is one direction only, not full mutual consistency of the two snapshots. A record older
 * than the audit's passes here, because the audit reflects at least that record; whether such
 * a record may be combined with the audit for other checks is not decided here (planning/07
 * §Consistency model, planning/09). Don't use this as a general snapshot-consistency gate.
 *
 * Times are compared as instants, so `08:00-05:00` and `13:00Z` are the same time.
 *
 * @param audit - The audit snapshot, with the time of the student record it ran against.
 * @param studentRecordEffectiveAt - When the student record the other checks read took effect.
 *   ISO 8601 with seconds and an offset.
 * @param maxSkewMs - The partner-specific maximum skew in milliseconds. Required: the engine has
 *   no safe default.
 * @returns PASS when the audit is not older than the record beyond the skew, or UNKNOWN (`AUDIT_STALE`) when the record
 *   changed after the audit by more than the skew.
 * @throws {AuditRecordInputError} When a timestamp has no offset or isn't a valid
 *   instant, or `maxSkewMs` isn't a non-negative safe integer.
 */
export function checkAuditReflectsRecord(
  audit: AuditSnapshot,
  studentRecordEffectiveAt: string,
  maxSkewMs: number,
): AuditRecordReflection {
  // SAFETY: a missing, negative, fractional, or infinite skew would silently widen or disable
  // the staleness window, so it is rejected instead of defaulted (planning/07 §Consistency
  // model: partner-specific maximum skew).
  if (!Number.isSafeInteger(maxSkewMs) || maxSkewMs < 0) {
    throw new AuditRecordInputError('maxSkewMs');
  }
  const auditRecordAt = toInstant(audit.studentRecordEffectiveAt, 'audit.studentRecordEffectiveAt');
  const recordAt = toInstant(studentRecordEffectiveAt, 'studentRecordEffectiveAt');
  // SAFETY: a record newer than the audit's record by more than the skew means the audit
  // doesn't reflect it, so audit-derived checks are UNKNOWN rather than a mixed-snapshot PASS
  // (planning/07 §Consistency model; AC10). A record older than the audit's is not audit
  // staleness: the audit reflects at least that record.
  // TODO(#62): decide the reverse direction, a record older than the audit's, in the student
  // snapshot freshness check; this function deliberately doesn't.
  return recordAt - auditRecordAt > maxSkewMs ? AUDIT_STALE : REFLECTS_RECORD;
}

/**
 * Parses an ISO 8601 timestamp with an explicit offset into epoch milliseconds.
 *
 * @param value - The timestamp.
 * @param field - The input it came from, named in the error.
 * @returns Milliseconds since the epoch.
 * @throws {AuditRecordInputError} When the value has no offset or isn't a valid instant.
 */
function toInstant(value: string, field: AuditRecordInputField): number {
  // SAFETY: a timestamp without an offset parses in the host's time zone, so the same inputs
  // could compare differently on different machines (NFR-01).
  const instant = INSTANT_PATTERN.test(value) ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(instant)) {
    throw new AuditRecordInputError(field);
  }
  return instant;
}
