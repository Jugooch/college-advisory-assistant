/**
 * @file In-memory copy of the dev seed's academic data (#127) for SYN-000001 and SYN-000002, so
 * service tests can check the README "Try the seeded academic scenarios" expectations. Every record
 * comes from the seed's own plan at one fixed run time, so a seed change needs no edit here (#255).
 * @module @caa/api/testing/seed-scenario-fixtures
 * @see packages/db/src/seed/dev-seed-academic-plan.ts
 * @see docs/standards/07-testing.md
 */
import { buildDevSeedPlan } from '@caa/db/testing';
import type { AuditSnapshot, Course, CourseAttempt, StudentSnapshot } from '@caa/domain';
import { buildStudent } from '@caa/test-kit';

import type { InMemoryAcademicStore } from './in-memory-academic-repositories';

/** The seed run the fixtures read: puts SYN-000001's record 7 hours before the API tests' clock. */
const SEED_RUN_AT = new Date('2026-09-01T08:00:00.000Z');

const { students, academic } = buildDevSeedPlan(SEED_RUN_AT);

/** The seed's one ruleset version. */
export const SEED_RULESET = academic.policy.rulesetVersion;

/**
 * Reads one record from the plan, failing loudly if the seed no longer has it.
 *
 * @param records - Records to search.
 * @param description - What is wanted, for the error message.
 * @param matches - Whether a record is the one wanted.
 * @returns The record.
 */
function pick<T>(records: readonly T[], description: string, matches: (record: T) => boolean): T {
  const found = records.find(matches);
  if (found === undefined) throw new Error(`The dev seed plan has no ${description}.`);
  return found;
}

/**
 * Builds a seeded student from the plan.
 *
 * @param sourceStudentId - The student's SIS ID, such as `SYN-000001`.
 * @param seed - Number in the test-kit student's other synthetic fields.
 * @returns The student.
 */
function seedStudent(sourceStudentId: string, seed: number) {
  const { id, tenantId } = pick(
    students,
    sourceStudentId,
    (student) => student.sourceStudentId === sourceStudentId,
  );
  return buildStudent({ id, tenantId, sourceStudentId }, seed);
}

/** SYN-000001 (happy path) and SYN-000002 (stale audit), as the seed writes them. */
export const SEED_STUDENTS = {
  current: seedStudent('SYN-000001', 1),
  stale: seedStudent('SYN-000002', 2),
} as const;

/**
 * Reads a seeded catalog course by its source ID.
 *
 * @param sourceCourseId - Such as `DEMO-MATH-101`.
 * @returns The course.
 */
function seedCourse(sourceCourseId: string): Course {
  return pick(
    academic.courses,
    sourceCourseId,
    (course) => course.sourceCourseId === sourceCourseId,
  );
}

/** The seeded catalog, by key. */
export const SEED_COURSES = {
  math101: seedCourse('DEMO-MATH-101'),
  math102: seedCourse('DEMO-MATH-102'),
  phys201: seedCourse('DEMO-PHYS-201'),
  phys301: seedCourse('DEMO-PHYS-301'),
  phys301Lab: seedCourse('DEMO-PHYS-301L'),
  engl101: seedCourse('DEMO-ENGL-101'),
  ind390: seedCourse('DEMO-IND-390'),
} as const;

/** The seeded prerequisite rules. DEMO-MATH 101, DEMO-ENGL 101, the lab, and IND 390 have an explicit `NONE` rule. */
export const SEED_RULES = academic.rules;

/** The seeded policy: in-progress prerequisites allowed, MOST_RECENT repeats, 12.00 to 18.00. */
export const SEED_POLICY = academic.policy;

/** The seeded term calendar, oldest first. */
export const SEED_TERMS = academic.terms;

/** The seeded attempts: SYN-000001's three, then SYN-000002's one. */
export const SEED_ATTEMPTS: readonly CourseAttempt[] = academic.attempts;

/**
 * Reads one seeded snapshot of a student.
 *
 * @param student - The student.
 * @param description - Which snapshot, for the error message.
 * @param matches - Whether a snapshot is the one wanted.
 * @returns The snapshot.
 */
function seedSnapshot(
  student: { readonly id: string },
  description: string,
  matches: (snapshot: StudentSnapshot) => boolean,
): StudentSnapshot {
  return pick(
    academic.snapshots,
    description,
    (snapshot) => snapshot.studentId === student.id && matches(snapshot),
  );
}

const byRecordTime = (a: StudentSnapshot, b: StudentSnapshot) =>
  a.sourceEffectiveAt.localeCompare(b.sourceEffectiveAt);
const staleSnapshots = academic.snapshots
  .filter((snapshot) => snapshot.studentId === SEED_STUDENTS.stale.id)
  .sort(byRecordTime);

/** The seeded snapshots: SYN-000001's, and SYN-000002's older and newer ones. */
export const SEED_SNAPSHOTS = {
  current: seedSnapshot(SEED_STUDENTS.current, 'SYN-000001 snapshot', () => true),
  staleOlder: seedSnapshot(
    SEED_STUDENTS.stale,
    'older SYN-000002 snapshot',
    (snapshot) => snapshot === staleSnapshots[0],
  ),
  staleNewer: seedSnapshot(
    SEED_STUDENTS.stale,
    'newer SYN-000002 snapshot',
    (snapshot) => snapshot === staleSnapshots[1],
  ),
} as const;

/**
 * Reads a student's seeded audit. The seed suffixes each audit version with its run time so a
 * rerun mints a new version; the suffix is dropped so the tests see the stable version name.
 *
 * @param student - The student.
 * @returns The audit.
 */
function seedAudit(student: { readonly id: string }): AuditSnapshot {
  const audit = pick(
    academic.audits,
    `audit for ${student.id}`,
    (candidate) => candidate.studentId === student.id,
  );
  return { ...audit, auditVersion: audit.auditVersion.replace(/_\d+$/, '') };
}

/** The seeded audits: SYN-000001's current one, and SYN-000002's stale one. */
export const SEED_AUDITS = {
  current: seedAudit(SEED_STUDENTS.current),
  stale: seedAudit(SEED_STUDENTS.stale),
} as const;

/**
 * Builds the seeded academic store. Each call returns fresh arrays, so a test may change them.
 *
 * @returns Catalog, rules, policy, terms, attempts, snapshots, and audits of the seed.
 */
export function buildSeedAcademicStore(): InMemoryAcademicStore {
  return {
    courses: Object.values(SEED_COURSES),
    rules: [...SEED_RULES],
    policies: [SEED_POLICY],
    terms: SEED_TERMS,
    attempts: [...SEED_ATTEMPTS],
    studentSnapshots: Object.values(SEED_SNAPSHOTS),
    audits: Object.values(SEED_AUDITS),
  };
}
