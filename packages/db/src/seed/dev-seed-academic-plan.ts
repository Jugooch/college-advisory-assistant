/**
 * @file Builds the synthetic academic plan the dev seed writes: the catalog module's data, fixed
 *   attempts, and one seed run's snapshots and audits, timed relative to that run. Pure given the
 *   run's clock reading; built with the domain factories, so an invalid record fails at once.
 * @module @caa/db/seed/dev-seed-academic-plan
 * @requirement FR-01
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import {
  type AcademicPolicy,
  AttemptStatus,
  type AuditSnapshot,
  type Course,
  type CourseAttempt,
  createAuditSnapshot,
  createCourseAttempt,
  createProgram,
  createStudentSnapshot,
  GradeScheme,
  LetterGrade,
  type PrerequisiteRule,
  type Program,
  type RequirementResultInput,
  RequirementState,
  type StudentSnapshot,
  type TermCalendar,
} from '@caa/domain';

import {
  SEED_CATALOG,
  SEED_POLICY,
  SEED_RULES,
  SEED_TENANT_ID,
  SEED_TERMS,
  seedId,
} from './dev-seed-academic-catalog';
import { seedInstantMs, seedRecordTimes, seedRevisionId } from './dev-seed-record-times';

/** Everything academic the dev seed writes, for one tenant. */
export interface DevSeedAcademicPlan {
  readonly programs: readonly Program[];
  readonly courses: readonly Course[];
  readonly rules: readonly PrerequisiteRule[];
  readonly policy: AcademicPolicy;
  readonly terms: TermCalendar;
  readonly attempts: readonly CourseAttempt[];
  readonly snapshots: readonly StudentSnapshot[];
  readonly audits: readonly AuditSnapshot[];
}

/** SYN-000001: the signed-in student, with a current audit. */
const CURRENT_STUDENT = '30000000-0000-4000-8000-000000000001';
/** SYN-000002: deliberately shows a stale audit (UNKNOWN), for advisors. */
const STALE_STUDENT = '30000000-0000-4000-8000-000000000002';
const PROGRAM = seedId('80000000', 1);

/** The seeded program, named as a catalog would. The ID is the one the snapshots and audits cite. */
const SEED_PROGRAMS: readonly Program[] = [
  createProgram({
    id: PROGRAM,
    tenantId: SEED_TENANT_ID,
    sourceProgramId: 'DEMO-BS-PHYS',
    name: 'Demo B.S. Physics',
  }),
];
const CATALOG_YEAR = '2025-2026';

const ATTEMPT = {
  math101First: seedId('60000000', 1),
  math101Repeat: seedId('60000000', 2),
  phys201InProgress: seedId('60000000', 3),
  staleStudentMath101: seedId('60000000', 4),
} as const;

/**
 * Builds a completed attempt with a letter grade and 3.00 earned credits.
 *
 * @param fields - Attempt ID, student, course, term, and grade.
 * @returns The attempt.
 */
function completed(fields: {
  readonly id: string;
  readonly studentId: string;
  readonly course: Course;
  readonly termCode: string;
  readonly grade: LetterGrade;
}): CourseAttempt {
  return createCourseAttempt({
    id: fields.id,
    tenantId: SEED_TENANT_ID,
    studentId: fields.studentId,
    courseId: fields.course.id,
    sourceAttemptId: `SYN-ATT-${fields.id.slice(-4)}`,
    termCode: fields.termCode,
    status: AttemptStatus.Completed,
    grade: { scheme: GradeScheme.Letter, value: fields.grade },
    creditsEarnedHundredths: 300,
  });
}

// NOTE: attempts don't change between seed runs, so each run's snapshots list the same rows,
// as an unchanged attempt belongs to every snapshot that contains it.
const ATTEMPTS: readonly CourseAttempt[] = [
  // NOTE: DEMO-MATH 101 repeated: D in 2025FA, then B in 2026SP (golden case GC-REP-001).
  completed({
    id: ATTEMPT.math101First,
    studentId: CURRENT_STUDENT,
    course: SEED_CATALOG.math101,
    termCode: '2025FA',
    grade: LetterGrade.D,
  }),
  completed({
    id: ATTEMPT.math101Repeat,
    studentId: CURRENT_STUDENT,
    course: SEED_CATALOG.math101,
    termCode: '2026SP',
    grade: LetterGrade.B,
  }),
  createCourseAttempt({
    id: ATTEMPT.phys201InProgress,
    tenantId: SEED_TENANT_ID,
    studentId: CURRENT_STUDENT,
    courseId: SEED_CATALOG.phys201.id,
    sourceAttemptId: 'SYN-ATT-0003',
    termCode: '2026FA',
    status: AttemptStatus.InProgress,
    grade: null,
    creditsEarnedHundredths: null,
  }),
  completed({
    id: ATTEMPT.staleStudentMath101,
    studentId: STALE_STUDENT,
    course: SEED_CATALOG.math101,
    termCode: '2026SP',
    grade: LetterGrade.A,
  }),
];

/** One seed run's snapshot IDs. */
interface RunSnapshotIds {
  readonly current: string;
  readonly staleOlder: string;
  readonly staleNewer: string;
}

/**
 * Builds one run's snapshots: SYN-000001's current record, and SYN-000002's older record (the
 * one its audit ran against) and newer record (a grade posted after that audit).
 *
 * @param now - The time the seed run started.
 * @param ids - The run's snapshot IDs.
 * @returns The snapshots.
 */
function buildSnapshots(now: Date, ids: RunSnapshotIds): readonly StudentSnapshot[] {
  const times = seedRecordTimes(now);
  const onProgram = { tenantId: SEED_TENANT_ID, programId: PROGRAM, catalogYear: CATALOG_YEAR };
  return [
    createStudentSnapshot({
      ...onProgram,
      id: ids.current,
      studentId: CURRENT_STUDENT,
      sourceEffectiveAt: times.currentRecordEffectiveAt,
      ingestedAt: times.currentRecordIngestedAt,
      attemptIds: [ATTEMPT.math101First, ATTEMPT.math101Repeat, ATTEMPT.phys201InProgress],
    }),
    createStudentSnapshot({
      ...onProgram,
      id: ids.staleOlder,
      studentId: STALE_STUDENT,
      sourceEffectiveAt: times.staleRecordEffectiveAt,
      ingestedAt: times.staleRecordIngestedAt,
      attemptIds: [],
    }),
    createStudentSnapshot({
      ...onProgram,
      id: ids.staleNewer,
      studentId: STALE_STUDENT,
      sourceEffectiveAt: times.currentRecordEffectiveAt,
      ingestedAt: times.currentRecordIngestedAt,
      attemptIds: [ATTEMPT.staleStudentMath101],
    }),
  ];
}

/**
 * Builds an audit's requirement tree: an INCOMPLETE root, then for SYN-000001 its COMPLETE,
 * IN_PROGRESS, and INCOMPLETE children.
 *
 * @param withChildren - Whether to add SYN-000001's child requirements.
 * @returns The requirements in audit order.
 */
function requirementTree(withChildren: boolean): RequirementResultInput[] {
  const node = (fields: Partial<RequirementResultInput> & { sourceRequirementId: string }) => ({
    parentSourceRequirementId: 'REQ-DEMO-BS',
    label: fields.sourceRequirementId,
    state: RequirementState.Incomplete,
    allocatedAttemptIds: [],
    remainingCreditsHundredths: null,
    remainingCourseCount: null,
    candidateCourseIds: [],
    isReusable: false,
    // NOTE: resolved within the audit's source and version, so it doesn't repeat them.
    sourceRef: `requirement/${fields.sourceRequirementId}`,
    ...fields,
  });
  const root = node({
    sourceRequirementId: 'REQ-DEMO-BS',
    parentSourceRequirementId: null,
    label: 'Demo B.S. requirements',
    remainingCourseCount: withChildren ? 2 : 3,
  });
  if (!withChildren) {
    return [root];
  }
  const { math101, math102, phys201, phys301, engl101, ind390 } = SEED_CATALOG;
  return [
    root,
    node({
      sourceRequirementId: 'REQ-MATH-CORE',
      label: 'Mathematics core',
      state: RequirementState.Complete,
      allocatedAttemptIds: [ATTEMPT.math101Repeat],
      remainingCreditsHundredths: 0,
      candidateCourseIds: [math101.id],
    }),
    node({
      sourceRequirementId: 'REQ-PHYS-SEQ',
      label: 'Physics sequence',
      state: RequirementState.InProgress,
      allocatedAttemptIds: [ATTEMPT.phys201InProgress],
      remainingCourseCount: 1,
      candidateCourseIds: [phys201.id, phys301.id],
    }),
    node({
      sourceRequirementId: 'REQ-ELECTIVES',
      label: 'Electives',
      remainingCreditsHundredths: 300,
      candidateCourseIds: [engl101.id, ind390.id, math102.id],
    }),
  ];
}

/**
 * Builds one run's audits. Each run's audit versions carry the run time, so they never collide
 * with an earlier run's.
 *
 * @param now - The time the seed run started.
 * @param snapshots - The run's snapshot IDs.
 * @returns SYN-000001's current audit and SYN-000002's stale one.
 */
function buildAudits(now: Date, snapshots: RunSnapshotIds): readonly AuditSnapshot[] {
  const times = seedRecordTimes(now);
  const run = String(seedInstantMs(now));
  const base = {
    tenantId: SEED_TENANT_ID,
    programId: PROGRAM,
    auditSource: 'demo-audit',
    catalogYear: CATALOG_YEAR,
  };
  return [
    createAuditSnapshot({
      ...base,
      id: seedRevisionId('70000000', 1, now),
      studentId: CURRENT_STUDENT,
      // SAFETY: pinned to this run's snapshot of the same student, program, and catalog, at the
      // same record time, so the happy path shows neither AUDIT_STALE nor AUDIT_PROGRAM_MISMATCH.
      studentSnapshotId: snapshots.current,
      auditVersion: `audit_demo_r1_${run}`,
      generatedAt: times.currentAuditGeneratedAt,
      studentRecordEffectiveAt: times.currentRecordEffectiveAt,
      requirements: requirementTree(true),
    }),
    createAuditSnapshot({
      ...base,
      id: seedRevisionId('70000000', 2, now),
      studentId: STALE_STUDENT,
      // SAFETY: deliberately pinned to the older snapshot; the newer one makes this audit stale.
      studentSnapshotId: snapshots.staleOlder,
      auditVersion: `audit_demo_r2_${run}`,
      generatedAt: times.staleAuditGeneratedAt,
      studentRecordEffectiveAt: times.staleRecordEffectiveAt,
      requirements: requirementTree(false),
    }),
  ];
}

/**
 * Builds the fully synthetic academic plan for one seed run. The catalog, rules, policy, terms,
 * and attempts are fixed; the snapshots and audits are new revisions timed relative to `now`.
 *
 * @param now - The time the seed run started, read once by the caller.
 * @returns The plan. The same `now` always gives the same plan.
 * @throws {RangeError} When `now` is invalid.
 * @throws {z.ZodError} When a built record violates its domain schema.
 */
export function buildDevSeedAcademicPlan(now: Date): DevSeedAcademicPlan {
  const snapshotIds: RunSnapshotIds = {
    current: seedRevisionId('a0000000', 1, now),
    staleOlder: seedRevisionId('a0000000', 2, now),
    staleNewer: seedRevisionId('a0000000', 3, now),
  };
  return {
    programs: SEED_PROGRAMS,
    courses: Object.values(SEED_CATALOG),
    rules: SEED_RULES,
    policy: SEED_POLICY,
    terms: SEED_TERMS,
    attempts: ATTEMPTS,
    snapshots: buildSnapshots(now, snapshotIds),
    audits: buildAudits(now, snapshotIds),
  };
}
