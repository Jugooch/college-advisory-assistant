/**
 * @file Decides whether a degree audit reflects the pinned student record: same student, same revision, same time.
 * @module @caa/engine/verification/check-audit-reflects-record
 * @requirement FR-04
 * @requirement FR-09
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { type AuditSnapshot, CheckState, ReasonCode, type StudentSnapshot } from '@caa/domain';

/** Whether the audit reflects the pinned student record. Anything short of PASS says why. */
export type AuditRecordReflection =
  | { readonly state: typeof CheckState.Pass; readonly reasonCode: null }
  | {
      readonly state: typeof CheckState.Unknown;
      readonly reasonCode: typeof ReasonCode.AuditStale | typeof ReasonCode.AuditAmbiguous;
    };

/** The pinned student record the audit is compared with, and how much skew is allowed. */
export interface PinnedStudentRecord {
  /** The student record revision every other check reads. */
  readonly studentSnapshot: StudentSnapshot;
  /**
   * The partner-specific maximum skew, in milliseconds, between the snapshot's
   * `sourceEffectiveAt` and the audit's `studentRecordEffectiveAt`, in either direction. A
   * non-negative safe integer; there is no default.
   */
  readonly maxSkewMs: number;
}

/**
 * The record time alone, without the pinned snapshot. It can't check which student or revision
 * the audit ran against, so only tests may use it.
 */
// TODO(#122): remove once the golden and acceptance callers pass a PinnedStudentRecord.
export interface StudentRecordFreshness {
  /** When the student record the other checks read took effect. ISO 8601 with offset. */
  readonly studentRecordEffectiveAt: string;
  /** The maximum skew, in milliseconds, that the record may be newer than the audit's. */
  readonly maxSkewMs: number;
}

/** Input fields whose values {@link checkAuditReflectsRecord} can reject. */
export type AuditRecordInputField =
  | 'audit.studentRecordEffectiveAt'
  | 'studentSnapshot.sourceEffectiveAt'
  | 'studentRecordEffectiveAt'
  | 'maxSkewMs';

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
const AUDIT_AMBIGUOUS: AuditRecordReflection = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.AuditAmbiguous,
};

/**
 * Checks that the audit was run against the pinned student record. In order:
 * 1. The audit is for another tenant or student: UNKNOWN (`AUDIT_AMBIGUOUS`).
 * 2. The audit ran against another snapshot: UNKNOWN, `AUDIT_STALE` when the pinned record's
 *    `sourceEffectiveAt` is later than the audit's `studentRecordEffectiveAt`, otherwise
 *    `AUDIT_AMBIGUOUS`. The skew doesn't apply.
 * 3. Same snapshot, but the pinned record is later than the audit's record time by more than
 *    `maxSkewMs`: UNKNOWN (`AUDIT_STALE`).
 * 4. Same snapshot, but the pinned record is earlier than the audit's record time by more than
 *    `maxSkewMs`: UNKNOWN (`AUDIT_AMBIGUOUS`).
 * 5. Otherwise PASS. Exactly `maxSkewMs` apart still passes, one millisecond more doesn't.
 *
 * PASS says nothing about the program and catalog; see `checkAuditProgramAndCatalog`. Times are
 * compared as instants, so `08:00-05:00` and `13:00Z` are the same time.
 *
 * The transitional string form compares times only, in one direction: a record newer than the
 * audit's beyond the skew is `AUDIT_STALE`, anything else passes.
 *
 * @param audit - The audit snapshot, with the snapshot and record time it ran against.
 * @param record - The pinned student snapshot, or (transitional, tests only) the record time.
 * @param maxSkewMs - The partner-specific maximum skew in milliseconds. Required: the engine has
 *   no safe default.
 * @returns PASS, or UNKNOWN with `AUDIT_STALE` or `AUDIT_AMBIGUOUS`.
 * @throws {AuditRecordInputError} When a timestamp has no offset or isn't a valid instant, or
 *   `maxSkewMs` isn't a non-negative safe integer.
 */
export function checkAuditReflectsRecord(
  audit: AuditSnapshot,
  record: StudentSnapshot | string,
  maxSkewMs: number,
): AuditRecordReflection {
  // SAFETY: a missing, negative, fractional, or infinite skew would silently widen or disable
  // the staleness window, so it is rejected instead of defaulted (planning/07 §Consistency
  // model: partner-specific maximum skew).
  if (!Number.isSafeInteger(maxSkewMs) || maxSkewMs < 0) {
    throw new AuditRecordInputError('maxSkewMs');
  }
  const auditRecordAt = toInstant(audit.studentRecordEffectiveAt, 'audit.studentRecordEffectiveAt');
  if (typeof record === 'string') {
    // TODO(#122): remove the time-only form once no caller passes a bare record time.
    const newerByMs = toInstant(record, 'studentRecordEffectiveAt') - auditRecordAt;
    return newerByMs > maxSkewMs ? AUDIT_STALE : REFLECTS_RECORD;
  }
  const newerByMs =
    toInstant(record.sourceEffectiveAt, 'studentSnapshot.sourceEffectiveAt') - auditRecordAt;
  return reflectSnapshot(audit, record, { newerByMs, maxSkewMs });
}

/** How far the pinned record's time is from the audit's record time, and the allowed skew. */
interface RecordTimeGap {
  /** The pinned record's time minus the audit's record time; negative when it is older. */
  readonly newerByMs: number;
  readonly maxSkewMs: number;
}

/**
 * Compares the pinned snapshot with the audit, in the order {@link checkAuditReflectsRecord}
 * documents.
 *
 * @param audit - The audit snapshot.
 * @param record - The pinned student snapshot.
 * @param gap - The record's time relative to the audit's record, and the allowed skew.
 * @returns PASS, or UNKNOWN with `AUDIT_STALE` or `AUDIT_AMBIGUOUS`.
 */
function reflectSnapshot(
  audit: AuditSnapshot,
  record: StudentSnapshot,
  { newerByMs, maxSkewMs }: RecordTimeGap,
): AuditRecordReflection {
  // SAFETY: an audit of another tenant's or student's record says nothing about this student,
  // so its requirement states are never read as theirs (planning/09 §Canonical entities:
  // AuditSnapshot references its student snapshot; §Source authority matrix).
  if (audit.tenantId !== record.tenantId || audit.studentId !== record.studentId) {
    return AUDIT_AMBIGUOUS;
  }
  // SAFETY: an audit run against another revision of the record is a mixed snapshot, which
  // blocks validation whatever the times say (planning/07 §Consistency model: mismatched
  // dependent snapshots block validated recommendations; AC10). A later pinned record means the
  // audit is older than what it must reflect; otherwise the audit reflects a revision other
  // than the pinned one and the two conflict.
  if (audit.studentSnapshotId !== record.id) {
    return newerByMs > 0 ? AUDIT_STALE : AUDIT_AMBIGUOUS;
  }
  // SAFETY: the record changed after the audit's record by more than the skew, so the audit
  // doesn't reflect it (planning/07 §Consistency model: transcript newer than the audit is
  // UNKNOWN; AC10).
  if (newerByMs > maxSkewMs) {
    return AUDIT_STALE;
  }
  // SAFETY: the audit reports a record time later than the snapshot it names, by more than the
  // skew. The two sources disagree about which record the audit saw, so neither is taken as
  // right (planning/09 §Proposed freshness policies: transcript and audit mutually consistent;
  // planning/08 §Rule lifecycle: a disagreement suspends the affected claim).
  if (-newerByMs > maxSkewMs) {
    return AUDIT_AMBIGUOUS;
  }
  return REFLECTS_RECORD;
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
