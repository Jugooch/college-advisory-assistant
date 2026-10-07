/**
 * @file Publishes a newer synthetic source revision for the first vertical slice student, so a
 *   draft saved against the earlier one becomes stale. Append-only and idempotent: earlier
 *   snapshots are never touched, and a run that is not strictly newer than the latest is refused.
 * @module @caa/db/seed/revise-slice-sources
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { InstitutionIdSchema, StudentIdSchema, TermIdSchema } from '@caa/domain';

import type { Database } from '../client';
import { createSectionSnapshotRepository } from '../repositories/section-snapshot.repository';
import { createStudentRepository } from '../repositories/student.repository';
import { createStudentSnapshotRepository } from '../repositories/student-snapshot.repository';
import { courseAttemptTable } from '../tables/course-attempt.table';
import { SEED_TENANT_ID, SEED_TERMS } from './dev-seed-academic-catalog';
import { seedInstantMs } from './dev-seed-record-times';
import { buildStudentRevision, type ReviseTarget } from './dev-seed-revision-plan';
import { buildWithdrawnSectionSnapshot } from './dev-seed-section-plan';
import { insertSectionSnapshot } from './section-snapshot-writer';
import { insertSnapshot } from './seed-academic-data';

/** Source ID of the slice student in the seed. */
const SLICE_SOURCE_STUDENT_ID = 'SYN-000001';
const PLANNING_TERM_CODE = '2027SP';

/** Thrown when the dev seed has not run, so there is nothing to supersede. */
export class ReviseNotSeededError extends Error {
  /** Creates the error. */
  constructor() {
    super('Nothing to supersede; run db:seed first');
    this.name = 'ReviseNotSeededError';
  }
}

/** Thrown when the latest stored revision is not strictly older than this run. */
export class ReviseNotNewerError extends Error {
  /** Creates the error. */
  constructor() {
    super('A source revision at or after this run time already exists; nothing was written');
    this.name = 'ReviseNotNewerError';
  }
}

/** What a revise run did. Counts and flags only, safe to log. */
export interface ReviseResult {
  readonly target: ReviseTarget;
  /** False when the same run time had already published this revision. */
  readonly published: boolean;
}

/**
 * Publishes the next revision of the chosen source for the slice student's tenant.
 *
 * @param db - Typed database handle.
 * @param target - `student` for a grade change, `sections` for a withdrawn section.
 * @param now - The time the run started, read once by the caller; the revision takes effect then.
 * @returns Whether a revision was written.
 * @throws {ReviseNotSeededError} When the seed data is missing.
 * @throws {ReviseNotNewerError} When the latest revision is at or after `now`, or ties.
 * @throws {RangeError} When `now` is invalid.
 */
export async function reviseSliceSources(
  db: Database,
  target: ReviseTarget,
  now: Date,
): Promise<ReviseResult> {
  seedInstantMs(now);
  const wasPublished =
    target === 'student' ? await reviseStudent(db, now) : await reviseSections(db, now);
  return { target, published: wasPublished };
}

/**
 * Decides whether a revision may be written.
 *
 * @param latest - Latest stored revision's ID and effective time, or null; ambiguous throws.
 * @param nextId - ID of the revision about to be written.
 * @param now - The run time.
 * @returns False when this exact revision already exists, true when it is strictly newer.
 */
function isNewer(
  latest: { id: string; at: string } | 'AMBIGUOUS' | null,
  nextId: string,
  now: Date,
) {
  if (latest === null) {
    return true;
  }
  // SAFETY: a late older batch must never become, or tie for, the newest truth.
  if (latest === 'AMBIGUOUS') {
    throw new ReviseNotNewerError();
  }
  if (latest.id === nextId) {
    return false;
  }
  if (Date.parse(latest.at) >= now.getTime()) {
    throw new ReviseNotNewerError();
  }
  return true;
}

async function reviseStudent(db: Database, now: Date): Promise<boolean> {
  const tenantId = InstitutionIdSchema.parse(SEED_TENANT_ID);
  const student = await createStudentRepository(db).findBySourceStudentId(
    tenantId,
    SLICE_SOURCE_STUDENT_ID,
  );
  if (!student) {
    throw new ReviseNotSeededError();
  }
  const { attempt, snapshot } = buildStudentRevision(now, student.id);
  const latest = await createStudentSnapshotRepository(db).findLatest(
    tenantId,
    StudentIdSchema.parse(student.id),
  );
  const head =
    latest === null
      ? null
      : latest.status === 'AMBIGUOUS'
        ? 'AMBIGUOUS'
        : { id: latest.revision.snapshot.id, at: latest.revision.snapshot.sourceEffectiveAt };
  if (!isNewer(head, snapshot.id, now)) {
    return false;
  }
  await db.transaction(async (tx) => {
    const { grade, ...fields } = attempt;
    await tx
      .insert(courseAttemptTable)
      .values({
        ...fields,
        gradeScheme: grade?.scheme ?? null,
        gradeValue: grade?.value ?? null,
      })
      .onConflictDoNothing({ target: courseAttemptTable.id });
    await insertSnapshot(tx, snapshot, student.id);
  });
  return true;
}

async function reviseSections(db: Database, now: Date): Promise<boolean> {
  const tenantId = InstitutionIdSchema.parse(SEED_TENANT_ID);
  const term = SEED_TERMS.find((candidate) => candidate.termCode === PLANNING_TERM_CODE);
  if (!term) {
    throw new ReviseNotSeededError();
  }
  const snapshot = buildWithdrawnSectionSnapshot(now);
  const latest = await createSectionSnapshotRepository(db).findLatestPublished(
    tenantId,
    TermIdSchema.parse(term.id),
  );
  if (latest === null) {
    throw new ReviseNotSeededError();
  }
  const head =
    latest.status === 'AMBIGUOUS'
      ? 'AMBIGUOUS'
      : { id: latest.snapshot.id, at: latest.snapshot.sourceEffectiveAt };
  if (!isNewer(head, snapshot.id, now)) {
    return false;
  }
  await db.transaction(async (tx) => {
    await insertSectionSnapshot(tx, snapshot);
  });
  return true;
}
