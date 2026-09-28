/**
 * @file Writes a dev seed plan with idempotent upserts on natural keys, in one transaction.
 * @module @caa/db/seed/seed-dev-data
 * @requirement FR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import type { Database } from '../client';
import { advisorAssignmentTable } from '../tables/advisor-assignment.table';
import { institutionTable } from '../tables/institution.table';
import { studentTable } from '../tables/student.table';
import { userIdentityTable } from '../tables/user-identity.table';
import type { DevSeedPlan, SeedAssignment, SeedIdentity, SeedStudent } from './dev-seed-plan';
import { type AcademicSeedCounts, seedAcademicData } from './seed-academic-data';

/** How many records of each kind the seed wrote. Counts only, safe to log. */
export interface SeedCounts extends AcademicSeedCounts {
  readonly institutions: number;
  readonly identities: number;
  readonly students: number;
  readonly assignments: number;
}

/** The part of a database handle or transaction the seed writes through. */
type SeedWriter = Pick<Database, 'insert'>;

/** Stored ID for a natural key, so later records link to the row that actually exists. */
type IdByKey = ReadonlyMap<string, string>;

/**
 * Upserts every record in the plan. Running it again leaves the same rows.
 *
 * @param db - Typed database handle.
 * @param plan - Synthetic records to write.
 * @returns How many records of each kind were written.
 * @throws {Error} When the plan links to an identity or student it does not contain, or its
 *   academic records refer to something the plan doesn't hold (`AcademicSeedReferenceError`).
 *   Nothing is written in that case.
 */
export async function seedDevData(db: Database, plan: DevSeedPlan): Promise<SeedCounts> {
  return db.transaction(async (tx) => {
    for (const institution of plan.institutions) {
      await tx
        .insert(institutionTable)
        .values(institution)
        .onConflictDoUpdate({
          target: institutionTable.id,
          set: { name: institution.name, timezone: institution.timezone },
        });
    }
    const userIds = await upsertIdentities(tx, plan.identities);
    const studentIds = await upsertStudents(tx, plan.students, userIds);
    await upsertAssignments(tx, plan.assignments, { userIds, studentIds });
    const academicCounts = await seedAcademicData(tx, plan.academic, (planStudentId) => {
      const student = plan.students.find((candidate) => candidate.id === planStudentId);
      if (!student) {
        throw new Error('Dev seed plan links to a record it does not contain');
      }
      return lookup(studentIds, studentKey(student.tenantId, student.sourceStudentId));
    });
    return {
      ...academicCounts,
      institutions: plan.institutions.length,
      identities: plan.identities.length,
      students: plan.students.length,
      assignments: plan.assignments.length,
    };
  });
}

// ---- Upserts per entity ----

async function upsertIdentities(
  tx: SeedWriter,
  identities: readonly SeedIdentity[],
): Promise<IdByKey> {
  const ids = new Map<string, string>();
  for (const identity of identities) {
    const rows = await tx
      .insert(userIdentityTable)
      .values({ ...identity, roles: [...identity.roles] })
      .onConflictDoUpdate({
        target: [userIdentityTable.issuer, userIdentityTable.subject],
        set: { roles: [...identity.roles], status: identity.status },
      })
      .returning({ id: userIdentityTable.id });
    ids.set(identityKey(identity.tenantId, identity.subject), requireId(rows[0]?.id));
  }
  return ids;
}

async function upsertStudents(
  tx: SeedWriter,
  students: readonly SeedStudent[],
  userIds: IdByKey,
): Promise<IdByKey> {
  const ids = new Map<string, string>();
  for (const student of students) {
    const userId =
      student.userSubject === null
        ? null
        : lookup(userIds, identityKey(student.tenantId, student.userSubject));
    const rows = await tx
      .insert(studentTable)
      .values({
        id: student.id,
        tenantId: student.tenantId,
        sourceStudentId: student.sourceStudentId,
        userId,
        recordVersion: null,
        sourceEffectiveAt: new Date(student.sourceEffectiveAt),
      })
      .onConflictDoUpdate({
        target: [studentTable.tenantId, studentTable.sourceStudentId],
        // NOTE: only the login link is restored; imported source fields are left as they are.
        set: { userId },
      })
      .returning({ id: studentTable.id });
    ids.set(studentKey(student.tenantId, student.sourceStudentId), requireId(rows[0]?.id));
  }
  return ids;
}

async function upsertAssignments(
  tx: SeedWriter,
  assignments: readonly SeedAssignment[],
  links: { readonly userIds: IdByKey; readonly studentIds: IdByKey },
): Promise<void> {
  for (const assignment of assignments) {
    const values = {
      tenantId: assignment.tenantId,
      advisorUserId: lookup(
        links.userIds,
        identityKey(assignment.tenantId, assignment.advisorSubject),
      ),
      studentId: lookup(
        links.studentIds,
        studentKey(assignment.tenantId, assignment.sourceStudentId),
      ),
      approvedBy: lookup(
        links.userIds,
        identityKey(assignment.tenantId, assignment.approverSubject),
      ),
      effectiveFrom: new Date(assignment.effectiveFrom),
      effectiveTo: assignment.effectiveTo === null ? null : new Date(assignment.effectiveTo),
    };
    await tx
      .insert(advisorAssignmentTable)
      .values({ id: assignment.id, ...values })
      .onConflictDoUpdate({ target: advisorAssignmentTable.id, set: values });
  }
}

// ---- Key helpers ----

// SECURITY: keys include the tenant, so a plan can never link records across tenants.
function identityKey(tenantId: string, subject: string): string {
  return `${tenantId}|${subject}`;
}

function studentKey(tenantId: string, sourceStudentId: string): string {
  return `${tenantId}|${sourceStudentId}`;
}

function lookup(ids: IdByKey, key: string): string {
  const id = ids.get(key);
  if (id === undefined) {
    throw new Error('Dev seed plan links to a record it does not contain');
  }
  return id;
}

function requireId(id: string | undefined): string {
  if (id === undefined) {
    throw new Error('Dev seed upsert returned no row');
  }
  return id;
}
