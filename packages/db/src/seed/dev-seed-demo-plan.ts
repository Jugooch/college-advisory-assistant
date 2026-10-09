/**
 * @file The demo seed plan: the whole dev seed plus synthetic personas for the local demo. Source
 *   records, identities, and assignments only; no plan, check result, or case is written here.
 * @module @caa/db/seed/dev-seed-demo-plan
 * @requirement FR-01
 * @requirement FR-11
 * @see docs/adr/0016-browser-e2e-and-local-demo.md
 */
import {
  AttemptStatus,
  createCourseAttempt,
  createStudentSnapshot,
  GradeScheme,
  IdentityStatus,
  LetterGrade,
  Role,
} from '@caa/domain';

import { SEED_CATALOG, SEED_TENANT_ID, seedId } from './dev-seed-academic-catalog';
import { SEED_CATALOG_YEAR, SEED_PROGRAM_ID } from './dev-seed-academic-plan';
import {
  buildDevSeedPlan,
  DEV_SEED_ISSUER,
  type DevSeedPlan,
  type SeedAssignment,
  type SeedIdentity,
  type SeedStudent,
} from './dev-seed-plan';
import { seedRecordTimes, seedRevisionId } from './dev-seed-record-times';

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
 * Builds a persona's attempt. Its ID is in a range the dev seed's attempts don't use.
 *
 * @param persona - The persona the attempt belongs to.
 * @param fields - Status and grade.
 * @returns The attempt.
 */
function attemptFor(persona: DemoPersona, fields: PersonaAttempt) {
  const id = seedId('60000000', 0x100 + persona.number);
  const isCompleted = fields.status === AttemptStatus.Completed;
  return createCourseAttempt({
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
 *   step saves a plan through the API, then publishes a newer revision.
 *
 * @param now - The time the seed run started, read once by the caller.
 * @returns The plan. The same `now` always gives the same plan.
 * @throws {RangeError} When `now` is invalid.
 */
export function buildDemoSeedPlan(now: Date): DevSeedPlan {
  const base = buildDevSeedPlan(now);
  const times = seedRecordTimes(now);
  const attempts = PERSONAS.map((persona) =>
    attemptFor(persona, ATTEMPT_BY_PURPOSE[persona.purpose]),
  );
  const identities: SeedIdentity[] = PERSONAS.map((persona) => ({
    id: seedId('20000000', 0x10 + persona.number),
    tenantId: SEED_TENANT_ID,
    issuer: DEV_SEED_ISSUER,
    subject: `synthetic-student-${subjectNumber(persona.number)}`,
    roles: [Role.Student],
    status: IdentityStatus.Active,
  }));
  const students: SeedStudent[] = PERSONAS.map((persona) => ({
    id: studentId(persona.number),
    tenantId: SEED_TENANT_ID,
    sourceStudentId: sourceStudentId(persona.number),
    userSubject: `synthetic-student-${subjectNumber(persona.number)}`,
    sourceEffectiveAt: SOURCE_EFFECTIVE_AT,
  }));
  const assignments: SeedAssignment[] = PERSONAS.map((persona) => ({
    id: seedId('40000000', 0x10 + persona.number),
    tenantId: SEED_TENANT_ID,
    advisorSubject: ADVISOR_SUBJECT,
    sourceStudentId: sourceStudentId(persona.number),
    approverSubject: APPROVER_SUBJECT,
    effectiveFrom: SOURCE_EFFECTIVE_AT,
    effectiveTo: null,
  }));
  const snapshots = PERSONAS.map((persona, index) => {
    const attempt = attempts[index];
    if (!attempt) {
      throw new Error('Demo persona has no attempt');
    }
    return createStudentSnapshot({
      id: seedRevisionId('a0000000', 0x10 + persona.number, now),
      tenantId: SEED_TENANT_ID,
      studentId: studentId(persona.number),
      programId: SEED_PROGRAM_ID,
      catalogYear: SEED_CATALOG_YEAR,
      sourceEffectiveAt: times.currentRecordEffectiveAt,
      ingestedAt: times.currentRecordIngestedAt,
      attemptIds: [attempt.id],
    });
  });
  return {
    ...base,
    identities: [...base.identities, ...identities],
    students: [...base.students, ...students],
    assignments: [...base.assignments, ...assignments],
    academic: {
      ...base.academic,
      attempts: [...base.academic.attempts, ...attempts],
      snapshots: [...base.academic.snapshots, ...snapshots],
    },
  };
}
