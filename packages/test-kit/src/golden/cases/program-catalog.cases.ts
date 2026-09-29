/**
 * @file Golden cases: a pinned student record and the audit it ran against that disagree on the
 *   program or catalog, or a record that doesn't state one.
 * @module @caa/test-kit/golden/cases/program-catalog
 * @requirement FR-04
 * @requirement FR-05
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/adr/0005-shared-invariant-functions-in-domain.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, ReasonCode, RequirementState } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { syntheticId } from '../../fixtures/synthetic-id';
import { type GoldenCase } from '../golden-case.schema';
import { allocationCase, applicabilityCase } from '../golden-case-factories';
import { expectedCheck, mustNot, NEVER_PASS_WHEN_UNKNOWN } from '../golden-expectations';
import { auditWith, pinnedRecord, planned, S3_ADJUDICATED_ON } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const { math102, phys201 } = SYNTHETIC_COURSES;
const APPLIES = CheckKind.RequirementApplicability;
const ALLOCATES = CheckKind.RequirementAllocation;
const AUTHORITY =
  'planning/09 §Source authority matrix (SIS owns the program; block the claim if contradictory)';
const ADR_0005 = 'ADR-0005 (isSameProgramAndCatalog false → UNKNOWN AUDIT_PROGRAM_MISMATCH)';
const CATALOG = 'planning/13 AC09 (apply the student’s own catalog rules)';
const NOT_DECIDED = mustNot(
  CheckState.Fail,
  "must not decide from an audit of a program or catalog that isn't the student's",
);
const BOTH = [planned(math102), planned(phys201)];
const BOTH_LISTED = { candidateCourseIds: [math102.id, phys201.id] };

/**
 * Expects one UNKNOWN `AUDIT_PROGRAM_MISMATCH` check of the given kind.
 *
 * @param kind - Applicability or allocation.
 * @returns The expected check.
 */
function mismatch(kind: CheckKind): ReturnType<typeof expectedCheck> {
  return expectedCheck(kind, {
    state: CheckState.Unknown,
    reasonCode: ReasonCode.AuditProgramMismatch,
  });
}

/** Program and catalog cases. The default audit is for program seed 1, catalog 2025-2026. */
export const PROGRAM_CATALOG_CASES: readonly GoldenCase[] = [
  applicabilityCase({
    id: 'GC-PROG-001',
    family: GoldenRuleFamily.ProgramCatalog,
    title: 'A record in another program makes applicability unknown',
    requirementIds: ['FR-04', 'FR-05', 'T03', 'AC10'],
    inputs: {
      courseId: math102.id,
      audit: auditWith({}),
      freshness: pinnedRecord({ programId: syntheticId('program', 2) }),
    },
    expected: [mismatch(APPLIES)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_DECIDED],
    rationale:
      "The record says program 2, the audit describes program 1. Its outstanding requirement may not be the student's, so the listed course is not claimed to apply.",
    citations: [AUTHORITY, ADR_0005, 'planning/13 AC10'],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-PROG-002',
    family: GoldenRuleFamily.ProgramCatalog,
    title: 'A record on another catalog makes allocation unknown',
    requirementIds: ['FR-04', 'FR-05', 'T03', 'AC09'],
    inputs: {
      candidates: BOTH,
      audit: auditWith({
        ...BOTH_LISTED,
        remainingCourseCount: 2,
        remainingCreditsHundredths: 700,
      }),
      freshness: pinnedRecord({ catalogYear: '2024-2025' }),
    },
    expected: [mismatch(ALLOCATES)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_DECIDED],
    rationale:
      "The student follows the 2024-2025 catalog; the audit applied 2025-2026. Room in the audit's requirement says nothing about the student's own catalog.",
    citations: [CATALOG, AUTHORITY, ADR_0005],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GC-PROG-003',
    family: GoldenRuleFamily.ProgramCatalog,
    title: 'A record that states no program is unknown, not the audit’s program',
    requirementIds: ['FR-04', 'FR-05', 'T03'],
    inputs: {
      courseId: math102.id,
      audit: auditWith({}),
      freshness: pinnedRecord({ programId: null }),
    },
    expected: [mismatch(APPLIES)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_DECIDED],
    rationale:
      "The SIS supplied no program. A missing program is unknown, never assumed to be the audit's.",
    citations: [
      'planning/08 §Authority and result semantics (missing data → UNKNOWN)',
      ADR_0005,
      'packages/domain StudentSnapshot.programId (null is unknown, never the audit’s program)',
    ],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-PROG-004',
    family: GoldenRuleFamily.ProgramCatalog,
    title: 'A record that states no catalog makes allocation unknown',
    requirementIds: ['FR-04', 'FR-05', 'T03', 'AC09'],
    inputs: {
      candidates: [planned(math102)],
      audit: auditWith({}),
      freshness: pinnedRecord({ catalogYear: null }),
    },
    expected: [mismatch(ALLOCATES)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_DECIDED],
    rationale:
      "The SIS supplied no catalog, so whether the audit's catalog is the student's is unknown.",
    citations: ['planning/08 §Authority and result semantics (missing data → UNKNOWN)', ADR_0005],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GC-PROG-005',
    family: GoldenRuleFamily.ProgramCatalog,
    title: 'A program mismatch is unknown even where the audit says complete',
    requirementIds: ['FR-04', 'FR-05', 'T03'],
    inputs: {
      courseId: math102.id,
      audit: auditWith({
        state: RequirementState.Complete,
        remainingCreditsHundredths: 0,
        remainingCourseCount: 0,
      }),
      freshness: pinnedRecord({ programId: syntheticId('program', 2) }),
    },
    expected: [mismatch(APPLIES)],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, "must not deny progress from another program's audit"),
    ],
    rationale:
      "The audit's requirement is complete, but for program 1; the student is in program 2. A denial from that audit is as unsupported as an approval.",
    citations: [AUTHORITY, ADR_0005, 'planning/08 §Rule lifecycle (suspend the affected claim)'],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  allocationCase({
    id: 'GC-PROG-006',
    family: GoldenRuleFamily.ProgramCatalog,
    title: 'A program mismatch is reported instead of a contest in the audit',
    requirementIds: ['FR-04', 'FR-05', 'T03', 'AC05'],
    inputs: {
      candidates: BOTH,
      audit: auditWith({
        ...BOTH_LISTED,
        remainingCourseCount: 1,
        remainingCreditsHundredths: 300,
      }),
      freshness: pinnedRecord({ programId: syntheticId('program', 2) }),
    },
    expected: [mismatch(ALLOCATES)],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not validate the set'), NOT_DECIDED],
    rationale:
      "The audit shows two courses competing for one slot, but it isn't the student's program's audit, so the contest isn't evidence either; the check says why the audit can't be read.",
    citations: [ADR_0005, AUTHORITY, 'PR #123 (a program mismatch hides a contest)'],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
];
