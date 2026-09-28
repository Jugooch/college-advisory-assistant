/**
 * @file Contract for the read-only academic summary of one student: record, audit, and requirements.
 * @module @caa/api-contract/contracts/academic-summary
 * @requirement FR-02
 * @requirement FR-04
 * @requirement FR-05
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import {
  AuditSnapshotSchema,
  CheckState,
  isSameProgramAndCatalog,
  ReasonCode,
  RequirementResultSchema,
  RequirementState,
  StudentSnapshotSchema,
} from '@caa/domain';

import { defineEndpoint } from '../define-endpoint';
import { StudentResponseSchema } from './students.contract';

// NOTE: the domain schemas carry refinements, so zod can't `.pick()` from them. Fields are
// reused one by one through `.shape`, which keeps each field's own validation.
const SNAPSHOT_FIELDS = StudentSnapshotSchema.unwrap().shape;
const AUDIT_FIELDS = AuditSnapshotSchema.unwrap().shape;
const REQUIREMENT_FIELDS = RequirementResultSchema.unwrap().shape;

/**
 * Returns whether a list has no repeated values.
 *
 * @param values - Values to check.
 * @returns `true` when every value appears once.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Returns whether requirement IDs are unique and every parent names another listed requirement.
 *
 * @param requirements - The summary's requirements.
 * @returns `false` on a repeated ID or a self, dangling, or missing parent.
 */
function hasDistinctKnownParents(
  requirements: readonly {
    readonly sourceRequirementId: string;
    readonly parentSourceRequirementId: string | null;
  }[],
): boolean {
  const ids = new Set(requirements.map((requirement) => requirement.sourceRequirementId));
  return (
    ids.size === requirements.length &&
    requirements.every(
      ({ sourceRequirementId, parentSourceRequirementId: parent }) =>
        parent === null || (parent !== sourceRequirementId && ids.has(parent)),
    )
  );
}

/** The pinned student record revision the summary describes. */
export const SummaryStudentSnapshotSchema = z
  .object({
    id: SNAPSHOT_FIELDS.id,
    /** Official program in the record, or `null` when the source didn't supply one. */
    programId: SNAPSHOT_FIELDS.programId,
    /** Catalog the student follows, or `null` when the source didn't supply one. */
    catalogYear: SNAPSHOT_FIELDS.catalogYear,
    /** Point in time the record describes. ISO 8601 with offset. */
    sourceEffectiveAt: SNAPSHOT_FIELDS.sourceEffectiveAt,
  })
  .readonly();

/**
 * The audit revision the requirements come from. Its program and catalog are the audit's own,
 * so a reader can see when they differ from the record's.
 */
export const SummaryAuditSchema = z
  .object({
    auditSource: AUDIT_FIELDS.auditSource,
    auditVersion: AUDIT_FIELDS.auditVersion,
    programId: AUDIT_FIELDS.programId,
    catalogYear: AUDIT_FIELDS.catalogYear,
    /** When the audit system generated the audit. ISO 8601 with offset. */
    generatedAt: AUDIT_FIELDS.generatedAt,
  })
  .readonly();

/**
 * Whether the audit reflects the pinned student record, with the same shape the engine's
 * `checkAuditReflectsRecord` returns: PASS with no reason, or UNKNOWN (`AUDIT_STALE`) when the
 * record changed after the audit by more than the allowed skew. PASS says only that the audit
 * isn't stale for the record.
 */
export const AuditReflectsRecordSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal(CheckState.Pass), reasonCode: z.null() }).readonly(),
  z
    .object({ state: z.literal(CheckState.Unknown), reasonCode: z.literal(ReasonCode.AuditStale) })
    .readonly(),
]);

/**
 * Whether the audit is for the program and catalog in the student record: PASS when the record
 * states both and they equal the audit's, otherwise UNKNOWN (`AUDIT_PROGRAM_MISMATCH`). A record
 * that doesn't state its program or catalog can't be matched, so it is UNKNOWN too. Under
 * UNKNOWN, every requirement state needs verification: the audit may describe another program.
 */
export const ProgramCatalogConsistencySchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal(CheckState.Pass), reasonCode: z.null() }).readonly(),
  z
    .object({
      state: z.literal(CheckState.Unknown),
      reasonCode: z.literal(ReasonCode.AuditProgramMismatch),
    })
    .readonly(),
]);

/** One requirement of the audit, as the audit reports it. The app never recomputes it. */
export const SummaryRequirementSchema = z
  .object({
    sourceRequirementId: REQUIREMENT_FIELDS.sourceRequirementId,
    parentSourceRequirementId: REQUIREMENT_FIELDS.parentSourceRequirementId,
    label: REQUIREMENT_FIELDS.label,
    state: REQUIREMENT_FIELDS.state,
    /** Credits still needed in hundredths (350 = 3.5), or `null` when not measured in credits. */
    remainingCreditsHundredths: REQUIREMENT_FIELDS.remainingCreditsHundredths,
    /** Courses still needed, or `null` when the audit doesn't measure this in courses. */
    remainingCourseCount: REQUIREMENT_FIELDS.remainingCourseCount,
    candidateCourseIds: REQUIREMENT_FIELDS.candidateCourseIds,
    /** Reference to the requirement in the audit, shown as evidence for its state. */
    sourceRef: REQUIREMENT_FIELDS.sourceRef,
  })
  // SAFETY: same rule as the domain model. A COMPLETE requirement that still needs credits or
  // courses contradicts itself, so the UI must never be handed both halves to choose from
  // (planning/08 §Authority and result semantics: the audit owns requirement state).
  .refine(
    (requirement) =>
      requirement.state !== RequirementState.Complete ||
      ((requirement.remainingCreditsHundredths ?? 0) === 0 &&
        (requirement.remainingCourseCount ?? 0) === 0),
    {
      message: 'A COMPLETE requirement must not have a remaining quantity greater than 0',
      path: ['state'],
    },
  )
  // SAFETY: same rule as the domain model. A repeated candidate would be offered twice for one
  // requirement (planning/08 §Candidate formation and allocation).
  .refine((requirement) => isDistinct(requirement.candidateCourseIds), {
    message: 'candidateCourseIds must not repeat a course',
    path: ['candidateCourseIds'],
  })
  .readonly();

/**
 * Response body for `GET /v1/students/:studentId/academic-summary`.
 *
 * SECURITY: data minimization. Carries no tenant, login, or attempt data; the student is the
 * same minimal shape as `GET /v1/students/:studentId`.
 */
export const AcademicSummaryResponseSchema = z
  .object({
    student: StudentResponseSchema,
    studentSnapshot: SummaryStudentSnapshotSchema,
    /** The audit the requirements come from, or `null` when the student has no audit. */
    audit: SummaryAuditSchema.nullable(),
    /**
     * Whether the audit reflects the pinned record, or `null` exactly when `audit` is `null`:
     * with no audit there is nothing to compare. `null` is never a PASS. Under UNKNOWN
     * (`AUDIT_STALE`), every requirement state is the audit's as of `audit.generatedAt` and
     * must be shown as needing verification, never as the student's current standing.
     */
    auditReflectsRecord: AuditReflectsRecordSchema.nullable(),
    /**
     * Whether the audit's program and catalog are the record's, or `null` exactly when `audit`
     * is `null`. `null` is never a PASS. Under UNKNOWN (`AUDIT_PROGRAM_MISMATCH`), every
     * requirement state must be shown as needing verification, never as current.
     */
    programCatalogConsistency: ProgramCatalogConsistencySchema.nullable(),
    /**
     * The audit's requirements in audit order. Empty exactly when `audit` is `null`. Their
     * states are the audit's as of `audit.generatedAt`: when `auditReflectsRecord` is UNKNOWN
     * (`AUDIT_STALE`) or `programCatalogConsistency` is UNKNOWN (`AUDIT_PROGRAM_MISMATCH`), they
     * must be shown as needing verification, never as current.
     */
    requirements: z.array(SummaryRequirementSchema).readonly(),
  })
  // SAFETY: a verdict with no audit, or an audit with no verdict, would let the UI show
  // requirement states without saying whether they reflect the record (planning/07
  // §Consistency model; planning/09 §Canonical entities: AuditSnapshot detects skew).
  .refine((summary) => (summary.audit === null) === (summary.auditReflectsRecord === null), {
    message: 'auditReflectsRecord is null exactly when audit is null',
    path: ['auditReflectsRecord'],
  })
  .refine((summary) => (summary.audit === null) === (summary.programCatalogConsistency === null), {
    message: 'programCatalogConsistency is null exactly when audit is null',
    path: ['programCatalogConsistency'],
  })
  // SAFETY: a record and an audit that disagree on program or catalog, or a record that doesn't
  // say, are conflicting or missing data, so the verdict is UNKNOWN, never PASS; and a match is
  // never reported as a mismatch (planning/09 §Source authority matrix: block the affected
  // claim if contradictory; planning/08 §Rule lifecycle: suspend the affected claim).
  .refine(
    (summary) =>
      summary.audit === null ||
      summary.programCatalogConsistency?.state ===
        (isSameProgramAndCatalog(summary.studentSnapshot, summary.audit)
          ? CheckState.Pass
          : CheckState.Unknown),
    {
      message: 'programCatalogConsistency must be UNKNOWN exactly when program or catalog differ',
      path: ['programCatalogConsistency'],
    },
  )
  // SAFETY: requirement states come only from an audit, and a degree audit always has one
  // (planning/09 §Canonical entities: AuditSnapshot holds the requirement tree).
  .refine((summary) => (summary.audit === null) === (summary.requirements.length === 0), {
    message: 'requirements are empty exactly when audit is null',
    path: ['requirements'],
  })
  // SAFETY: a repeated ID or a dangling parent would detach a requirement from the audit tree,
  // so its parent's state could be read without it (planning/08 §Candidate formation and
  // allocation: the audit owns the requirement tree).
  // NOTE: cycles aren't rechecked here; the requirements come from an `AuditSnapshot`, whose
  // schema already rejects them.
  .refine((summary) => hasDistinctKnownParents(summary.requirements), {
    message: 'sourceRequirementId must be unique and parents must be listed requirements',
    path: ['requirements'],
  })
  .readonly();

/** Response body for `GET /v1/students/:studentId/academic-summary`. */
export type AcademicSummaryResponse = z.infer<typeof AcademicSummaryResponseSchema>;

/**
 * Reads the pinned record, audit, and requirement states of one student the signed-in user may
 * see. Others are NOT_FOUND. Read-only: nothing is written to an institutional system.
 */
export const getAcademicSummaryEndpoint = defineEndpoint({
  method: 'GET',
  path: '/v1/students/:studentId/academic-summary',
  response: AcademicSummaryResponseSchema,
});
