/**
 * @file Golden cases: an audit read against a pinned student record that isn't the one it ran
 *   against (another tenant, student, or snapshot revision), or whose record time disagrees with
 *   the pinned snapshot's beyond the allowed skew.
 * @module @caa/test-kit/golden/cases/pinned-record
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-01
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, ReasonCode } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { syntheticId } from '../../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../../fixtures/synthetic-tenants';
import { type GoldenCase } from '../golden-case.schema';
import { allocationCase, applicabilityCase } from '../golden-case-factories';
import { expectedCheck, mustNot, NEVER_PASS_WHEN_UNKNOWN } from '../golden-expectations';
import { auditWith, pinnedRecord, planned, S3_ADJUDICATED_ON } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const { math102, phys201 } = SYNTHETIC_COURSES;
const APPLIES = CheckKind.RequirementApplicability;
const ALLOCATES = CheckKind.RequirementAllocation;
const ONE_HOUR_MS = 3_600_000;
const MIXED = 'planning/07 §Consistency model (mismatched dependent snapshots block validation)';
const PINNED =
  'planning/09 §Canonical entities (AuditSnapshot references its student snapshot; tenant_id)';
const AMBIGUOUS_CODE =
  'packages/domain ReasonCode (AUDIT_AMBIGUOUS: another tenant, student, or snapshot)';
const PR_123 = 'PR #123 (audit checked against the pinned snapshot)';
const NOT_READ = mustNot(CheckState.Fail, 'must not decide from an audit of another record');
/** Both courses fit the default audit's requirement, so only the pinned record can block. */
const ROOMY_AUDIT = auditWith({
  candidateCourseIds: [math102.id, phys201.id],
  remainingCourseCount: 2,
  remainingCreditsHundredths: 700,
});
const BOTH = [planned(math102), planned(phys201)];

/**
 * Expects one UNKNOWN check of the given kind.
 *
 * @param kind - Applicability or allocation.
 * @param reasonCode - The expected reason.
 * @returns The expected check.
 */
function unknown(kind: CheckKind, reasonCode: ReasonCode): ReturnType<typeof expectedCheck> {
  return expectedCheck(kind, { state: CheckState.Unknown, reasonCode });
}

/** Pinned-record cases. The default audit ran against snapshot seed 1 at 07:30-05:00. */
export const PINNED_RECORD_CASES: readonly GoldenCase[] = [
  applicabilityCase({
    id: 'GC-PIN-001',
    family: GoldenRuleFamily.AuditRecordMismatch,
    title: "An audit of another student's record is unknown",
    requirementIds: ['FR-04', 'FR-05', 'T01', 'T03'],
    inputs: {
      courseId: math102.id,
      audit: auditWith({}),
      freshness: pinnedRecord({ studentId: syntheticId('student', 2) }),
    },
    expected: [unknown(APPLIES, ReasonCode.AuditAmbiguous)],
    allowedAlternatives: [[unknown(APPLIES, ReasonCode.AuditStale)]],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_READ],
    rationale:
      "The audit ran against student 1's record; the pinned record is student 2's. The audit says nothing about student 2, so its requirement states are never read as theirs.",
    citations: [PINNED, MIXED, AMBIGUOUS_CODE, PR_123],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-PIN-002',
    family: GoldenRuleFamily.AuditRecordMismatch,
    title: "An audit of another tenant's record makes allocation unknown",
    requirementIds: ['FR-04', 'FR-05', 'T01', 'T03'],
    inputs: {
      candidates: BOTH,
      audit: ROOMY_AUDIT,
      freshness: pinnedRecord({ tenantId: SYNTHETIC_TENANTS.b.id }),
    },
    expected: [unknown(ALLOCATES, ReasonCode.AuditAmbiguous)],
    allowedAlternatives: [[unknown(ALLOCATES, ReasonCode.AuditStale)]],
    prohibitedClaims: [
      mustNot(CheckState.Pass, "must not validate a plan from another tenant's audit"),
      NOT_READ,
    ],
    rationale:
      "The pinned record belongs to tenant B and the audit to tenant A. Tenant data never crosses, so both courses' fit is unknown although the audit has room for both.",
    citations: [
      'planning/09 §Canonical entities (composite rules prevent cross-tenant references)',
      AMBIGUOUS_CODE,
      PR_123,
    ],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GC-PIN-003',
    family: GoldenRuleFamily.AuditRecordMismatch,
    title: 'Another snapshot revision at the same time is unknown',
    requirementIds: ['FR-04', 'FR-05', 'T03', 'AC10'],
    inputs: {
      courseId: math102.id,
      audit: auditWith({}),
      freshness: pinnedRecord({}, ONE_HOUR_MS, 2),
    },
    expected: [unknown(APPLIES, ReasonCode.AuditAmbiguous)],
    allowedAlternatives: [[unknown(APPLIES, ReasonCode.AuditStale)]],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_READ],
    rationale:
      'The audit ran against snapshot 1, the checks read snapshot 2. Equal times do not make two revisions the same record, and a skew never joins two revisions.',
    citations: [MIXED, 'planning/13 AC10 (no mixed-snapshot validation)', AMBIGUOUS_CODE],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-PIN-004',
    family: GoldenRuleFamily.AuditRecordMismatch,
    title: 'An older snapshot revision within the skew is still unknown',
    requirementIds: ['FR-04', 'FR-05', 'T03', 'AC10'],
    inputs: {
      candidates: BOTH,
      audit: ROOMY_AUDIT,
      freshness: pinnedRecord(
        {
          sourceEffectiveAt: '2026-09-20T07:00:00.000-05:00',
          ingestedAt: '2026-09-20T07:05:00.000-05:00',
        },
        ONE_HOUR_MS,
        2,
      ),
    },
    expected: [unknown(ALLOCATES, ReasonCode.AuditAmbiguous)],
    allowedAlternatives: [[unknown(ALLOCATES, ReasonCode.AuditStale)]],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_READ],
    rationale:
      "Snapshot 2 is 30 minutes older than the audit's snapshot 1, inside the one-hour skew. The skew allows clock drift within one revision; it never makes an audit of one revision valid for another.",
    citations: [MIXED, 'planning/13 AC10', AMBIGUOUS_CODE],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GC-STALE-004',
    family: GoldenRuleFamily.AuditStale,
    title: "A snapshot older than the audit's record beyond the skew is unknown",
    requirementIds: ['FR-04', 'NFR-04', 'T02', 'T03'],
    inputs: {
      courseId: math102.id,
      audit: auditWith({}),
      freshness: pinnedRecord(
        {
          sourceEffectiveAt: '2026-09-20T06:00:00.000-05:00',
          ingestedAt: '2026-09-20T06:05:00.000-05:00',
        },
        ONE_HOUR_MS,
      ),
    },
    expected: [unknown(APPLIES, ReasonCode.AuditAmbiguous)],
    allowedAlternatives: [[unknown(APPLIES, ReasonCode.AuditStale)]],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not decide while the sources disagree'),
    ],
    rationale:
      "The audit names snapshot 1 but records its time as 07:30, 90 minutes after the snapshot's own 06:00, with 60 allowed. The two sources disagree about the record the audit saw, so neither is taken as right.",
    citations: [
      'planning/09 §Proposed freshness policies (transcript and audit mutually consistent)',
      'planning/08 §Rule lifecycle (a disagreement suspends the affected claim)',
      'packages/domain ReasonCode (AUDIT_AMBIGUOUS: pinned record older beyond the skew)',
      PR_123,
    ],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-STALE-005',
    family: GoldenRuleFamily.AuditStale,
    title: "A snapshot older than the audit's record by exactly the skew passes",
    requirementIds: ['FR-04', 'NFR-04', 'T02', 'T03'],
    inputs: {
      candidates: BOTH,
      audit: ROOMY_AUDIT,
      freshness: pinnedRecord(
        {
          sourceEffectiveAt: '2026-09-20T11:30:00.000Z',
          ingestedAt: '2026-09-20T11:35:00.000Z',
        },
        ONE_HOUR_MS,
      ),
    },
    expected: [expectedCheck(ALLOCATES, { state: CheckState.Pass, reasonCode: null })],
    prohibitedClaims: [
      mustNot(CheckState.Unknown, 'must not reject a record within the partner skew'),
    ],
    rationale:
      "11:30Z is 06:30-05:00, exactly 60 minutes before the audit's 07:30-05:00: within the skew in the older direction too. Both courses fit, so the set passes.",
    citations: [
      'planning/07 §Consistency model (partner-specific maximum skew)',
      'issue #56 (beyond maxSkew; compared as instants)',
      PR_123,
    ],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
];
