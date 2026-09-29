/**
 * @file Frozen holdout cases (v0.3) for an audit read against another record, and for the program
 *   and catalog the record and audit state. Kept out of engine development; see README.md in this
 *   folder before reading further.
 * @module @caa/tests/golden/holdout/holdout-audit-families
 * @requirement FR-04
 * @requirement FR-05
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, ReasonCode } from '@caa/domain';
import {
  allocationCase,
  applicabilityCase,
  auditRequirementRef,
  auditWith,
  expectedCheck,
  FRESH_RECORD,
  type GoldenCase,
  GoldenRuleFamily,
  mustNot,
  NEVER_PASS_WHEN_UNKNOWN,
  pinnedRecord,
  planned,
  SYNTHETIC_COURSES,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import { HOLDOUT_V03_ADJUDICATED_ON } from './holdout-grade-families.cases';

const { phys201 } = SYNTHETIC_COURSES;
const APPLIES = CheckKind.RequirementApplicability;
const ALLOCATES = CheckKind.RequirementAllocation;
const ONE_HOUR_MS = 3_600_000;
/** An outstanding requirement listing only DEMO-PHYS 201, with room for its 4.00 credits. */
const PHYS_AUDIT = auditWith({ candidateCourseIds: [phys201.id], remainingCreditsHundredths: 400 });
const MIXED = 'planning/07 §Consistency model (mismatched dependent snapshots block validation)';
const AMBIGUOUS =
  'packages/domain ReasonCode (AUDIT_AMBIGUOUS: another tenant, student, or snapshot)';
const ADR_0005 = 'ADR-0005 (isSameProgramAndCatalog false → UNKNOWN AUDIT_PROGRAM_MISMATCH)';
const NOT_READ = mustNot(CheckState.Fail, 'must not decide from an audit of another record');

/**
 * Expects one UNKNOWN `AUDIT_AMBIGUOUS` check, accepting `AUDIT_STALE` as the adjudicated
 * alternative, as the development cases of this family do.
 *
 * @param kind - Applicability or allocation.
 * @returns The expected check and its alternative.
 */
function ambiguous(kind: CheckKind): {
  expected: ReturnType<typeof expectedCheck>[];
  allowedAlternatives: ReturnType<typeof expectedCheck>[][];
} {
  return {
    expected: [
      expectedCheck(kind, { state: CheckState.Unknown, reasonCode: ReasonCode.AuditAmbiguous }),
    ],
    allowedAlternatives: [
      [expectedCheck(kind, { state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale })],
    ],
  };
}

/** Holdout cases for audit-record families that had no holdout case before v0.3. */
export const HOLDOUT_AUDIT_FAMILY_CASES: readonly GoldenCase[] = [
  applicabilityCase({
    id: 'GH-PIN-001',
    family: GoldenRuleFamily.AuditRecordMismatch,
    title: 'A newer snapshot revision within the skew is still unknown',
    requirementIds: ['FR-04', 'FR-05', 'T03', 'AC10'],
    inputs: {
      courseId: SYNTHETIC_COURSES.math102.id,
      audit: auditWith({}),
      freshness: pinnedRecord(
        {
          sourceEffectiveAt: '2026-09-20T07:45:00.000-05:00',
          ingestedAt: '2026-09-20T07:50:00.000-05:00',
        },
        ONE_HOUR_MS,
        3,
      ),
    },
    ...ambiguous(APPLIES),
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_READ],
    rationale:
      'The audit ran against snapshot 1; the checks read snapshot 3, 15 minutes newer. A skew allows clock drift within one revision and never joins two revisions.',
    citations: [MIXED, 'planning/13 AC10 (no mixed-snapshot validation)', AMBIGUOUS],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GH-PIN-002',
    family: GoldenRuleFamily.AuditRecordMismatch,
    title: "A record of another tenant can't read this tenant's audit",
    requirementIds: ['FR-04', 'FR-05', 'T01', 'T03'],
    inputs: {
      courseId: phys201.id,
      audit: PHYS_AUDIT,
      freshness: pinnedRecord({ tenantId: SYNTHETIC_TENANTS.b.id }),
    },
    ...ambiguous(APPLIES),
    prohibitedClaims: [mustNot(CheckState.Pass, "must not apply another tenant's audit"), NOT_READ],
    rationale:
      'The pinned record belongs to tenant B and the audit to tenant A. Tenant data never crosses, so the listed course is not claimed to apply.',
    citations: [
      'planning/09 §Canonical entities (composite rules prevent cross-tenant references)',
      AMBIGUOUS,
    ],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GH-PROG-001',
    family: GoldenRuleFamily.ProgramCatalog,
    title: 'A record on the audit’s program and catalog reads the audit',
    requirementIds: ['FR-04', 'FR-05', 'T03'],
    inputs: { courseId: phys201.id, audit: PHYS_AUDIT, freshness: FRESH_RECORD },
    expected: [
      expectedCheck(APPLIES, {
        state: CheckState.Pass,
        reasonCode: null,
        sourceRef: auditRequirementRef(1),
      }),
    ],
    prohibitedClaims: [
      mustNot(CheckState.Unknown, 'must not refuse an audit of the student’s own program'),
      mustNot(CheckState.Fail, 'must not deny what the audit lists'),
    ],
    rationale:
      'The record and the audit both state program 1 and catalog 2025-2026, so the audit is the student’s, and it lists DEMO-PHYS 201 for an outstanding requirement.',
    citations: [
      'planning/09 §Source authority matrix (SIS owns the program)',
      ADR_0005,
      'planning/08 evidence contract example (source_ref pins the audit item)',
    ],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GH-PROG-002',
    family: GoldenRuleFamily.ProgramCatalog,
    title: 'A record on a newer catalog makes allocation unknown',
    requirementIds: ['FR-04', 'FR-05', 'T03', 'AC09'],
    inputs: {
      candidates: [planned(phys201)],
      audit: PHYS_AUDIT,
      freshness: pinnedRecord({ catalogYear: '2026-2027' }),
    },
    expected: [
      expectedCheck(ALLOCATES, {
        state: CheckState.Unknown,
        reasonCode: ReasonCode.AuditProgramMismatch,
      }),
    ],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, "must not decide from another catalog's audit"),
    ],
    rationale:
      "The student follows the 2026-2027 catalog; the audit applied 2025-2026. Room in the audit's requirement says nothing about the student's own catalog.",
    citations: ['planning/13 AC09 (apply the student’s own catalog rules)', ADR_0005],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
];
