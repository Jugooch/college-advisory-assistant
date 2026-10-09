/**
 * @file The demo seed plan: the whole dev seed plus synthetic personas for the local demo. Source
 *   records, identities, and assignments only; no plan, check result, or case is written here.
 * @module @caa/db/seed/dev-seed-demo-plan
 * @requirement FR-01
 * @requirement FR-11
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */
import {
  AttemptStatus,
  type AuditSnapshot,
  type CourseAttempt,
  createAuditSnapshot,
  createCourseAttempt,
  createStudentSnapshot,
  GradeScheme,
  IdentityStatus,
  LetterGrade,
  Role,
  type StudentSnapshot,
} from '@caa/domain';

import { SEED_CATALOG, SEED_TENANT_ID, seedId } from './dev-seed-academic-catalog';
import { requirementTree, SEED_CATALOG_YEAR, SEED_PROGRAM_ID } from './dev-seed-academic-plan';
import {
  buildDevSeedPlan,
  DEV_SEED_ISSUER,
  type DevSeedPlan,
  type SeedAssignment,
  type SeedIdentity,
  type SeedStudent,
} from './dev-seed-plan';
import { seedInstantMs, seedRecordTimes, seedRevisionId } from './dev-seed-record-times';

/** A demo persona: what the walkthrough shows for one synthetic student. */
interface DemoPersona {
  /** Number in the subject (`synthetic-student-0NN`) and source ID (`SYN-0000NN`). */
  readonly number: number;
  /** What the persona demonstrates; documentation only. */
  readonly purpose: 'blocked prerequisite' | 'unknown data' | 'stale plan';
}

const PERSONAS: readonly DemoPersona[] = [
  { number: 4, purpose: 'blocked prerequisite' },
  { number: 5, purpose: 'unknown data' },
  { number: 6, purpose: 'stale plan' },
];

/** The one attempt each persona has, by what the persona demonstrates. */
type PersonaAttempt = Readonly<{
  status: typeof AttemptStatus.Completed | typeof AttemptStatus.TransferPending;
  grade: LetterGrade | null;
}>;

const ATTEMPT_BY_PURPOSE: Readonly<Record<DemoPersona['purpose'], PersonaAttempt>> = {
  'blocked prerequisite': { status: AttemptStatus.Completed, grade: LetterGrade.D },
  'unknown data': { status: AttemptStatus.TransferPending, grade: null },
  'stale plan': { status: AttemptStatus.Completed, grade: LetterGrade.A },
};

const ADVISOR_SUBJECT = 'synthetic-advisor-001';
const APPROVER_SUBJECT = 'synthetic-admin-001';
const SOURCE_EFFECTIVE_AT = '2026-08-15T00:00:00.000Z';

/**
 * Pads a persona number for subjects and source IDs.
 *
 * @param number - Persona number.
 * @returns The three-digit form.
 */
function subjectNumber(number: number): string {
  return String(number).padStart(3, '0');
}

/**
 * Builds a persona's source student ID.
 *
 * @param number - Persona number.
 * @returns The `SYN-0000NN` form.
 */
function sourceStudentId(number: number): string {
  return `SYN-${String(number).padStart(6, '0')}`;
}

/**
 * Builds a persona's student ID, in the style of the dev seed's fixed IDs.
 *
 * @param number - Persona number.
 * @returns The student ID.
 */
function studentId(number: number): string {
  return seedId('30000000', number);
}

/**
 * Builds a persona's attempts. IDs are in a range the dev seed's attempts and the revise
 * command's slots (0x1000 and up) don't use.
 *
 * @param persona - The persona the attempts belong to.
 * @param fields - Status and grade of the persona's MATH 101 attempt.
 * @returns The MATH 101 attempt, then for the stale-plan persona a completed PHYS 201 attempt.
 */
function attemptsFor(persona: DemoPersona, fields: PersonaAttempt): CourseAttempt[] {
  const id = seedId('60000000', 0x100 + persona.number);
  const isCompleted = fields.status === AttemptStatus.Completed;
  const math = createCourseAttempt({
    id,
    tenantId: SEED_TENANT_ID,
    studentId: studentId(persona.number),
    courseId: SEED_CATALOG.math101.id,
    sourceAttemptId: `SYN-ATT-${id.slice(-4)}`,
    termCode: '2026SP',
    status: fields.status,
    grade: fields.grade === null ? null : { scheme: GradeScheme.Letter, value: fields.grade },
    creditsEarnedHundredths: isCompleted ? 300 : null,
  });
  if (persona.purpose !== 'stale plan') {
    return [math];
  }
  // NOTE: with PHYS 201 passed, the persona is eligible for 12.00 credits in 2027SP, the policy
  // minimum, so a plan can be saved. The revise command later adds its own PHYS 201 attempt.
  const physId = seedId('60000000', 0x200 + persona.number);
  const phys = createCourseAttempt({
    id: physId,
    tenantId: SEED_TENANT_ID,
    studentId: studentId(persona.number),
    courseId: SEED_CATALOG.phys201.id,
    sourceAttemptId: `SYN-ATT-${physId.slice(-4)}`,
    termCode: '2026FA',
    status: AttemptStatus.Completed,
    grade: { scheme: GradeScheme.Letter, value: LetterGrade.C },
    creditsEarnedHundredths: 400,
  });
  return [math, phys];
}

/**
 * Builds a persona's sign-in identity.
 *
 * @param persona - The persona.
 * @returns The identity.
 */
function identityFor(persona: DemoPersona): SeedIdentity {
  return {
    id: seedId('20000000', 0x10 + persona.number),
    tenantId: SEED_TENANT_ID,
    issuer: DEV_SEED_ISSUER,
    subject: `synthetic-student-${subjectNumber(persona.number)}`,
    roles: [Role.Student],
    status: IdentityStatus.Active,
  };
}

/**
 * Builds a persona's student, linked to its identity.
 *
 * @param persona - The persona.
 * @returns The student.
 */
function studentFor(persona: DemoPersona): SeedStudent {
  return {
    id: studentId(persona.number),
    tenantId: SEED_TENANT_ID,
    sourceStudentId: sourceStudentId(persona.number),
    userSubject: `synthetic-student-${subjectNumber(persona.number)}`,
    sourceEffectiveAt: SOURCE_EFFECTIVE_AT,
  };
}

/**
 * Builds the assignment of a persona to the demo advisor.
 *
 * @param persona - The persona.
 * @returns The assignment.
 */
function assignmentFor(persona: DemoPersona): SeedAssignment {
  return {
    id: seedId('40000000', 0x10 + persona.number),
    tenantId: SEED_TENANT_ID,
    advisorSubject: ADVISOR_SUBJECT,
    sourceStudentId: sourceStudentId(persona.number),
    approverSubject: APPROVER_SUBJECT,
    effectiveFrom: SOURCE_EFFECTIVE_AT,
    effectiveTo: null,
  };
}

/**
 * Builds a persona's current student snapshot, holding its attempts.
 *
 * @param persona - The persona.
 * @param attemptIds - The persona's attempts.
 * @param now - The time the seed run started.
 * @returns The snapshot.
 */
function snapshotFor(
  persona: DemoPersona,
  attemptIds: readonly string[],
  now: Date,
): StudentSnapshot {
  const times = seedRecordTimes(now);
  return createStudentSnapshot({
    id: seedRevisionId('a0000000', 0x10 + persona.number, now),
    tenantId: SEED_TENANT_ID,
    studentId: studentId(persona.number),
    programId: SEED_PROGRAM_ID,
    catalogYear: SEED_CATALOG_YEAR,
    sourceEffectiveAt: times.currentRecordEffectiveAt,
    ingestedAt: times.currentRecordIngestedAt,
    attemptIds: [...attemptIds],
  });
}

/**
 * Builds a persona's degree audit: the source record that goes with its current snapshot.
 *
 * @param persona - The persona.
 * @param snapshot - The persona's current snapshot.
 * @param now - The time the seed run started.
 * @returns The audit, pinned to the snapshot, with only an INCOMPLETE root requirement.
 */
function auditFor(persona: DemoPersona, snapshot: StudentSnapshot, now: Date): AuditSnapshot {
  const times = seedRecordTimes(now);
  return createAuditSnapshot({
    id: seedRevisionId('70000000', 0x10 + persona.number, now),
    tenantId: SEED_TENANT_ID,
    programId: SEED_PROGRAM_ID,
    auditSource: 'demo-audit',
    catalogYear: SEED_CATALOG_YEAR,
    studentId: snapshot.studentId,
    // SAFETY: pinned to this persona's current snapshot at its record time, so no AUDIT_STALE or
    // AUDIT_PROGRAM_MISMATCH shows. A revise makes a newer snapshot, which is what stales a plan.
    studentSnapshotId: snapshot.id,
    auditVersion: `audit_demo_p${String(persona.number)}_${String(seedInstantMs(now))}`,
    generatedAt: times.currentAuditGeneratedAt,
    studentRecordEffectiveAt: snapshot.sourceEffectiveAt,
    // SAFETY: the root only, INCOMPLETE; the audit never decides what a persona demonstrates.
    requirements: requirementTree(false),
  });
}

/**
 * Builds the demo seed plan: the dev seed plan plus three personas, all assigned to
 * `synthetic-advisor-001`. The dev plan is included unchanged.
 *
 * - Blocked prerequisite (SYN-000004): DEMO-MATH 101 with a D, below the C that DEMO-MATH 102 and
 *   DEMO-PHYS 201 require, so those checks are NOT_MET.
 * - UNKNOWN data (SYN-000005): DEMO-MATH 101 as a pending transfer with no grade, which the
 *   engine can't decide, so those checks are UNKNOWN.
 * - Stale plan (SYN-000006): a completed DEMO-MATH 101 and nothing else; the demo's preparation
 *   step saves a plan through the API, then publishes a newer revision. A completed PHYS 201
 *   brings its eligible 2027SP courses to the policy's 12.00 credits.
 *
 * Each persona also has a degree audit pinned to its current snapshot: a source record, not a
 * result.
 *
 * @param now - The time the seed run started, read once by the caller.
 * @returns The plan. The same `now` always gives the same plan.
 * @throws {RangeError} When `now` is invalid.
 */
export function buildDemoSeedPlan(now: Date): DevSeedPlan {
  const base = buildDevSeedPlan(now);
  const attempts = PERSONAS.map((persona) =>
    attemptsFor(persona, ATTEMPT_BY_PURPOSE[persona.purpose]),
  );
  const snapshots = PERSONAS.map((persona, index) =>
    snapshotFor(
      persona,
      (attempts[index] ?? []).map((attempt) => attempt.id),
      now,
    ),
  );
  const audits = PERSONAS.map((persona, index) => {
    const snapshot = snapshots[index];
    if (!snapshot) {
      throw new RangeError('A persona has no snapshot');
    }
    return auditFor(persona, snapshot, now);
  });
  return {
    ...base,
    identities: [...base.identities, ...PERSONAS.map(identityFor)],
    students: [...base.students, ...PERSONAS.map(studentFor)],
    assignments: [...base.assignments, ...PERSONAS.map(assignmentFor)],
    academic: {
      ...base.academic,
      attempts: [...base.academic.attempts, ...attempts.flat()],
      snapshots: [...base.academic.snapshots, ...snapshots],
      audits: [...base.academic.audits, ...audits],
    },
  };
}
