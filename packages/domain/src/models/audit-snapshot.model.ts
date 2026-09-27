/**
 * @file Audit snapshot: one authoritative degree audit for one student, program, and catalog.
 * @module @caa/domain/models/audit-snapshot
 * @requirement FR-04
 * @requirement FR-05
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';
import { RequirementResultSchema } from './requirement-result.model';
import { StudentIdSchema } from './student.model';

/** Branded ID so an audit snapshot ID can never be passed where another ID is expected. */
export const AuditSnapshotIdSchema = z.uuid().brand<'AuditSnapshotId'>();

/** Unique identifier of an {@link AuditSnapshot}. */
export type AuditSnapshotId = z.infer<typeof AuditSnapshotIdSchema>;

/** Branded ID of an academic program (degree plan) the student is enrolled in. */
export const ProgramIdSchema = z.uuid().brand<'ProgramId'>();

/** Unique identifier of an academic program. */
export type ProgramId = z.infer<typeof ProgramIdSchema>;

/** Schema for an audit snapshot. Snapshots are immutable; a re-run audit is a new snapshot. */
export const AuditSnapshotSchema = z
  .object({
    id: AuditSnapshotIdSchema,
    tenantId: InstitutionIdSchema,
    studentId: StudentIdSchema,
    programId: ProgramIdSchema,
    /** Catalog the audit applies, as the institution labels it, for example `2025-2026`. */
    catalogYear: z.string().min(1),
    /** When the audit system generated this audit. ISO 8601 with offset. */
    generatedAt: z.iso.datetime({ offset: true }),
    /**
     * Point in time of the student record the audit ran against. ISO 8601 with offset. The
     * engine compares it with the student snapshot to detect transcript/audit skew.
     */
    studentRecordEffectiveAt: z.iso.datetime({ offset: true }),
    /** Requirement results in audit order. A degree audit always has at least one. */
    requirements: z.array(RequirementResultSchema).min(1).readonly(),
  })
  // SAFETY: an audit can't have been run against a record from its own future; that timestamp
  // pair would make the staleness check meaningless.
  // NOTE: compared as instants, because strings with different offsets don't sort lexically.
  .refine(
    (snapshot) => Date.parse(snapshot.studentRecordEffectiveAt) <= Date.parse(snapshot.generatedAt),
    {
      message: 'studentRecordEffectiveAt must not be later than generatedAt',
      path: ['studentRecordEffectiveAt'],
    },
  )
  // SAFETY: requirement IDs key allocation and evidence; a duplicate would make it ambiguous
  // which result the engine is reading.
  .refine(
    (snapshot) =>
      new Set(snapshot.requirements.map((result) => result.sourceRequirementId)).size ===
      snapshot.requirements.length,
    {
      message: 'sourceRequirementId must be unique within a snapshot',
      path: ['requirements'],
    },
  )
  .readonly();

/** A validated, immutable audit snapshot. */
export type AuditSnapshot = z.infer<typeof AuditSnapshotSchema>;

/** Raw input accepted by {@link createAuditSnapshot}. */
export type AuditSnapshotInput = z.input<typeof AuditSnapshotSchema>;

/**
 * Creates a validated, immutable audit snapshot.
 *
 * @param input - Raw snapshot fields.
 * @returns The parsed audit snapshot.
 * @throws {z.ZodError} When a field or requirement is invalid, the record time is after the
 *   generation time, or a `sourceRequirementId` repeats.
 */
export function createAuditSnapshot(input: AuditSnapshotInput): AuditSnapshot {
  return AuditSnapshotSchema.parse(input);
}
