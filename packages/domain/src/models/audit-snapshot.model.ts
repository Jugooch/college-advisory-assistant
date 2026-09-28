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
import { ProgramIdSchema } from './program.model';
import { RequirementResultSchema } from './requirement-result.model';
import { StudentIdSchema } from './student.model';
import { StudentSnapshotIdSchema } from './student-snapshot.model';

/** Branded ID so an audit snapshot ID can never be passed where another ID is expected. */
export const AuditSnapshotIdSchema = z.uuid().brand<'AuditSnapshotId'>();

/** Unique identifier of an {@link AuditSnapshot}. */
export type AuditSnapshotId = z.infer<typeof AuditSnapshotIdSchema>;

/** The tree fields of a requirement that the snapshot-level checks read. */
interface RequirementNode {
  readonly sourceRequirementId: string;
  readonly parentSourceRequirementId: string | null;
}

/**
 * Returns whether every parent reference names another requirement in the same snapshot.
 *
 * @param nodes - Requirements of one snapshot.
 * @returns `false` when a requirement names itself or a parent that isn't in the snapshot.
 */
function hasKnownParents(nodes: readonly RequirementNode[]): boolean {
  const ids = new Set(nodes.map((node) => node.sourceRequirementId));
  return nodes.every(
    (node) =>
      node.parentSourceRequirementId === null ||
      (node.parentSourceRequirementId !== node.sourceRequirementId &&
        ids.has(node.parentSourceRequirementId)),
  );
}

/**
 * Returns whether following parent references from any requirement always ends at a root.
 *
 * @param nodes - Requirements of one snapshot.
 * @returns `false` when any chain of parents revisits a requirement.
 */
function isAcyclic(nodes: readonly RequirementNode[]): boolean {
  const parents = new Map(
    nodes.map((node) => [node.sourceRequirementId, node.parentSourceRequirementId]),
  );
  return nodes.every((node) => {
    const seen = new Set([node.sourceRequirementId]);
    let current = node.parentSourceRequirementId;
    while (current !== null) {
      if (seen.has(current)) return false;
      seen.add(current);
      current = parents.get(current) ?? null;
    }
    return true;
  });
}

/**
 * Schema for an audit snapshot. Snapshots are immutable; a re-run audit is a new snapshot.
 *
 * `auditSource` and `auditVersion` pin the snapshot to one audit revision (for example
 * `audit_demo_r7` in the planning/08 evidence contract). Every `sourceRef` in its requirements
 * is resolved within that source and version.
 *
 * `studentSnapshotId` pins the student record revision the audit was run against, so a check
 * can tell which revision it is comparing with. `studentRecordEffectiveAt` stays alongside it:
 * the audit system reports it, and the skew check compares it with the newer record's time.
 */
export const AuditSnapshotSchema = z
  .object({
    id: AuditSnapshotIdSchema,
    tenantId: InstitutionIdSchema,
    studentId: StudentIdSchema,
    /**
     * Student snapshot the audit was run against. It belongs to the same tenant and student;
     * the persistence layer enforces that, because a schema sees only this object.
     */
    studentSnapshotId: StudentSnapshotIdSchema,
    programId: ProgramIdSchema,
    /** Audit system that produced this audit, for example `demo-audit`. */
    auditSource: z.string().min(1),
    /** The audit system's run or revision ID, for example `audit_demo_r7`. */
    auditVersion: z.string().min(1),
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
  // SAFETY: a dangling or self parent would detach a requirement from the audit's tree, so
  // its parent's state could be read without it.
  .refine((snapshot) => hasKnownParents(snapshot.requirements), {
    message: 'parentSourceRequirementId must refer to another requirement in the snapshot',
    path: ['requirements'],
  })
  // SAFETY: a cycle has no root, so no requirement in it has an authoritative parent state.
  .refine((snapshot) => isAcyclic(snapshot.requirements), {
    message: 'Requirement parents must not form a cycle',
    path: ['requirements'],
  })
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
 *   generation time, a `sourceRequirementId` repeats, or a parent reference is missing,
 *   self-referential, or cyclic.
 */
export function createAuditSnapshot(input: AuditSnapshotInput): AuditSnapshot {
  return AuditSnapshotSchema.parse(input);
}
