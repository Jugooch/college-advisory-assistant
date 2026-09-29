/**
 * @file Shared actors, world, and requests for the academic endpoint acceptance cases (AC27 to
 * AC31): `GET /v1/students/:studentId/academic-summary` and
 * `POST /v1/students/:studentId/course-checks`. The default world is one tenant A student with a
 * fresh record and the audit run against it, so each case states only what it varies.
 * @module @caa/tests/support/academic-endpoints-harness
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/standards/07-testing.md
 */
import {
  type AcademicPolicyInput,
  type AuditSnapshot,
  type AuditSnapshotInput,
  type CourseAttempt,
  type RequirementResultInput,
  Role,
  type StudentSnapshot,
  type StudentSnapshotInput,
} from '@caa/domain';
import {
  buildAcademicPolicy,
  buildAdvisorAssignment,
  buildAuditSnapshot,
  buildPrerequisiteRule,
  buildRequirementResult,
  buildStudent,
  buildStudentSnapshot,
  buildTermCalendar,
  buildUserIdentity,
  SYNTHETIC_COURSES,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import {
  type AcceptanceApp,
  type AcceptanceResponse,
  type AcceptanceWorld,
  buildAcceptanceApp,
  getAs,
  postAs,
} from './api-harness';

/** Student seed 1, whose record every case reads. */
export const ACADEMIC_STUDENT_ID = '30000000-0000-4000-8000-000000000001';

/** A student ID that no world stores. */
export const MISSING_STUDENT_ID = '30000000-0000-4000-8000-0000000003e7';

/** When the default record describes the student: six hours before the harness clock. */
export const RECORD_AT = '2026-09-01T06:00:00.000Z';

/** When the default audit was generated, against the record at {@link RECORD_AT}. */
export const AUDIT_GENERATED_AT = '2026-09-01T07:00:00.000Z';

/** Everyone who signs in to the academic endpoint cases. */
export const ACADEMIC_ACTORS = {
  /** The student themself: user seed 1, linked to student seed 1. */
  student: buildUserIdentity({ roles: [Role.Student] }, 1),
  /** An advisor with an open assignment to student seed 1. */
  advisor: buildUserIdentity({ roles: [Role.Advisor] }, 2),
  /** An advisor in the same tenant with no assignment to student seed 1. */
  unassignedAdvisor: buildUserIdentity({ roles: [Role.Advisor] }, 4),
  /** Another student of the same tenant (student seed 2). */
  otherStudent: buildUserIdentity({ roles: [Role.Student] }, 5),
  /** An admin of tenant B. */
  tenantBAdmin: buildUserIdentity({ roles: [Role.Admin], tenantId: SYNTHETIC_TENANTS.b.id }, 6),
} as const;

/** Key of one of {@link ACADEMIC_ACTORS}. */
export type AcademicActor = keyof typeof ACADEMIC_ACTORS;

/** What a case varies in the default world. */
export interface AcademicScenario {
  /** Attempts the pinned record lists; none by default. */
  readonly attempts?: readonly CourseAttempt[];
  /** Policy switches; the rest are the conservative defaults with bounds 1.00 to 18.00. */
  readonly policy?: Partial<AcademicPolicyInput>;
  /** The audit's requirements (`REQ-001`, ...); by default one listing DEMO-MATH 102. */
  readonly requirements?: readonly Partial<RequirementResultInput>[];
}

/**
 * Builds a record snapshot of student seed 1 at {@link RECORD_AT}, ingested 30 minutes later.
 *
 * @param overrides - Snapshot fields a case varies.
 * @param seed - Snapshot seed; the default audit ran against seed 1.
 * @returns The snapshot.
 */
export function recordSnapshot(
  overrides: Partial<StudentSnapshotInput> = {},
  seed = 1,
): StudentSnapshot {
  return buildStudentSnapshot(
    { sourceEffectiveAt: RECORD_AT, ingestedAt: '2026-09-01T06:30:00.000Z', ...overrides },
    seed,
  );
}

/**
 * Builds the audit (`demo-audit`, `audit_demo_r1`) generated at {@link AUDIT_GENERATED_AT} against
 * snapshot seed 1 at {@link RECORD_AT}.
 *
 * @param requirements - Overrides for each requirement, in audit order.
 * @param overrides - Audit fields a case varies.
 * @returns The audit.
 */
export function recordAudit(
  requirements: readonly Partial<RequirementResultInput>[] = [{}],
  overrides: Partial<AuditSnapshotInput> = {},
): AuditSnapshot {
  return buildAuditSnapshot({
    generatedAt: AUDIT_GENERATED_AT,
    studentRecordEffectiveAt: RECORD_AT,
    requirements: requirements.map((item, index) => buildRequirementResult(item, index + 1)),
    ...overrides,
  });
}

/**
 * Creates the world: both tenant A students, the advisor's open assignment, and the default
 * academic data from {@link resetAcademicWorld}.
 *
 * @returns The world; mutate it between cases.
 */
export function createAcademicWorld(): AcceptanceWorld {
  const world: AcceptanceWorld = {
    identities: Object.values(ACADEMIC_ACTORS),
    students: [
      buildStudent({ userId: ACADEMIC_ACTORS.student.id }, 1),
      buildStudent({ userId: ACADEMIC_ACTORS.otherStudent.id }, 2),
    ],
    assignments: [buildAdvisorAssignment()],
  };
  resetAcademicWorld(world);
  return world;
}

/**
 * Resets the academic data: the record lists the scenario's attempts; the audit ran against it;
 * the full synthetic catalog; DEMO-MATH 102 requires DEMO-MATH 101 with C; ruleset
 * `demo-2026.1`; the synthetic terms.
 *
 * @param world - The world to reset.
 * @param scenario - What the case varies.
 */
export function resetAcademicWorld(world: AcceptanceWorld, scenario: AcademicScenario = {}): void {
  const attempts = scenario.attempts ?? [];
  world.attempts = attempts;
  world.studentSnapshots = [recordSnapshot({ attemptIds: attempts.map((item) => item.id) })];
  world.audits = [recordAudit(scenario.requirements)];
  world.courses = Object.values(SYNTHETIC_COURSES);
  world.rules = [buildPrerequisiteRule()];
  world.policies = [
    buildAcademicPolicy({
      termCreditBounds: { minCreditsHundredths: 100, maxCreditsHundredths: 1800 },
      ...scenario.policy,
    }),
  ];
  world.terms = buildTermCalendar();
}

/**
 * Builds the API over the world, accepting a token for every actor.
 *
 * @param world - Backing data.
 * @returns The app.
 */
export function buildAcademicApp(world: AcceptanceWorld): AcceptanceApp {
  return buildAcceptanceApp(
    world,
    Object.entries(ACADEMIC_ACTORS).map(([key, identity]) => ({
      token: `academic-${key}`,
      identity,
    })),
  );
}

/** The request's actor and student; defaults to the student reading their own record. */
export interface AcademicRequestAs {
  readonly actor?: AcademicActor;
  readonly studentId?: string;
}

/**
 * Reads the academic summary.
 *
 * @param app - App under test.
 * @param as - Actor and student.
 * @returns The response.
 */
export function readSummary(
  app: AcceptanceApp,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID }: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  return getAs(app, `/v1/students/${studentId}/academic-summary`, `Bearer academic-${actor}`);
}

/**
 * Runs course checks.
 *
 * @param app - App under test.
 * @param payload - The JSON body.
 * @param as - Actor and student.
 * @returns The response.
 */
export function checkCourses(
  app: AcceptanceApp,
  payload: object,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID }: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  return postAs(app, {
    url: `/v1/students/${studentId}/course-checks`,
    authorization: `Bearer academic-${actor}`,
    payload,
  });
}
