/**
 * @file Student snapshot: one immutable revision of a student's academic record, as imported.
 * @module @caa/domain/models/student-snapshot
 * @requirement FR-03
 * @requirement FR-05
 * @requirement NFR-01
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { CourseAttemptIdSchema } from './course-attempt.model';
import { InstitutionIdSchema } from './institution.model';
import { ProgramIdSchema } from './program.model';
import { StudentIdSchema } from './student.model';

/** Branded ID so a student snapshot ID can never be passed where another ID is expected. */
export const StudentSnapshotIdSchema = z.uuid().brand<'StudentSnapshotId'>();

/** Unique identifier of a {@link StudentSnapshot}. */
export type StudentSnapshotId = z.infer<typeof StudentSnapshotIdSchema>;

/**
 * Schema for a student snapshot: the pinned input revision that checks and audits run against
 * (planning/09 §Canonical entities). Snapshots are immutable; a refreshed record is a new
 * snapshot with a new ID, and earlier snapshots stay readable for historical results.
 *
 * The snapshot lists the attempts it contains by ID rather than each attempt naming its
 * snapshot. A `CourseAttemptId` names one immutable attempt revision: a changed source attempt
 * (for example a newly posted grade) is stored as a new attempt with a new ID, never updated in
 * place. An attempt unchanged between two imports then belongs to both snapshots without being
 * copied, and a snapshot's membership is fixed when it is written (a join table keyed by
 * snapshot and attempt, both tenant-scoped).
 *
 * Placements and holds (planning/09) are not modeled yet; they will join this object as
 * explicit fields when they are.
 */
export const StudentSnapshotSchema = z
  .object({
    id: StudentSnapshotIdSchema,
    tenantId: InstitutionIdSchema,
    studentId: StudentIdSchema,
    /**
     * Official program in the source record, or `null` when the source didn't supply one. The
     * engine treats a missing program as unknown, never as the audit's program.
     */
    programId: ProgramIdSchema.nullable(),
    /**
     * Catalog the student follows, as the institution labels it (for example `2025-2026`), or
     * `null` when the source didn't supply one.
     */
    catalogYear: z.string().min(1).nullable(),
    /** Course attempts in this revision of the record. Empty means the record lists none. */
    attemptIds: z.array(CourseAttemptIdSchema).readonly(),
    /**
     * Point in time the source record describes. ISO 8601 with offset. Freshness and
     * transcript/audit skew are judged from this time, never from `ingestedAt` (planning/07
     * §Consistency model).
     */
    sourceEffectiveAt: z.iso.datetime({ offset: true }),
    /** When the record was ingested into this system. ISO 8601 with offset. */
    ingestedAt: z.iso.datetime({ offset: true }),
  })
  // SAFETY: a record can't be ingested before the moment it describes; that pair would let a
  // snapshot look fresher than any data the source actually sent.
  // NOTE: compared as instants, because strings with different offsets don't sort lexically.
  .refine((snapshot) => Date.parse(snapshot.sourceEffectiveAt) <= Date.parse(snapshot.ingestedAt), {
    message: 'sourceEffectiveAt must not be later than ingestedAt',
    path: ['sourceEffectiveAt'],
  })
  // SAFETY: an attempt listed twice could be counted twice toward credits or a requirement.
  .refine((snapshot) => new Set(snapshot.attemptIds).size === snapshot.attemptIds.length, {
    message: 'attemptIds must list each attempt at most once',
    path: ['attemptIds'],
  })
  .readonly();

/** A validated, immutable student snapshot. */
export type StudentSnapshot = z.infer<typeof StudentSnapshotSchema>;

/** Raw input accepted by {@link createStudentSnapshot}. */
export type StudentSnapshotInput = z.input<typeof StudentSnapshotSchema>;

/**
 * Creates a validated, immutable student snapshot.
 *
 * @param input - Raw snapshot fields.
 * @returns The parsed student snapshot.
 * @throws {z.ZodError} When a field is invalid, `sourceEffectiveAt` is after `ingestedAt`, or
 *   an attempt ID repeats.
 */
export function createStudentSnapshot(input: StudentSnapshotInput): StudentSnapshot {
  return StudentSnapshotSchema.parse(input);
}
