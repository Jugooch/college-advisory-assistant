/**
 * @file The synthetic academic plan the dev seed writes: the catalog module's data plus student
 *   snapshots with attempts and audits with requirements. Data only; built with the domain
 *   factories, so an invalid record fails when this module loads.
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
  createStudentSnapshot,
  GradeScheme,
  LetterGrade,
  type PrerequisiteRule,
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

/** Everything academic the dev seed writes, for one tenant. */
export interface DevSeedAcademicPlan {
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
const CATALOG_YEAR = '2025-2026';

// SAFETY: every record and audit time lives here, so the skew between them is visible in one
// place. The current audit's record time equals its snapshot's source time (0 ms apart), so it
// reflects the record under any non-negative skew the API configures. The stale student's newer
// snapshot is 17 days after the record its audit was run against.
/** Source, ingestion, and audit times of the seeded records. ISO 8601 with offset. */
export const SEED_RECORD_TIMES = {
  currentRecordEffectiveAt: '2026-09-01T05:00:00.000Z',
  currentRecordIngestedAt: '2026-09-01T06:00:00.000Z',
  currentAuditGeneratedAt: '2026-09-01T07:00:00.000Z',
  staleRecordEffectiveAt: '2026-08-15T05:00:00.000Z',
  staleRecordIngestedAt: '2026-08-15T06:00:00.000Z',
  staleAuditGeneratedAt: '2026-08-15T07:00:00.000Z',
} as const;

const ATTEMPT = {
  math101First: seedId('60000000', 1),
  math101Repeat: seedId('60000000', 2),
  phys201InProgress: seedId('60000000', 3),
  staleStudentMath101: seedId('60000000', 4),
} as const;

const SNAPSHOT = {
  current: seedId('a0000000', 1),
  staleOlder: seedId('a0000000', 2),
  staleNewer: seedId('a0000000', 3),
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

/**
 * Builds a snapshot on the seeded program and catalog.
 *
 * @param fields - Snapshot ID, student, times, and attempts.
 * @returns The snapshot.
 */
function snapshot(fields: {
  readonly id: string;
  readonly studentId: string;
  readonly sourceEffectiveAt: string;
  readonly ingestedAt: string;
  readonly attemptIds: readonly string[];
}): StudentSnapshot {
  return createStudentSnapshot({
    ...fields,
    tenantId: SEED_TENANT_ID,
    programId: PROGRAM,
    catalogYear: CATALOG_YEAR,
  });
}

const SNAPSHOTS: readonly StudentSnapshot[] = [
  snapshot({
    id: SNAPSHOT.current,
    studentId: CURRENT_STUDENT,
    sourceEffectiveAt: SEED_RECORD_TIMES.currentRecordEffectiveAt,
    ingestedAt: SEED_RECORD_TIMES.currentRecordIngestedAt,
    attemptIds: [ATTEMPT.math101First, ATTEMPT.math101Repeat, ATTEMPT.phys201InProgress],
  }),
  snapshot({
    id: SNAPSHOT.staleOlder,
    studentId: STALE_STUDENT,
    sourceEffectiveAt: SEED_RECORD_TIMES.staleRecordEffectiveAt,
    ingestedAt: SEED_RECORD_TIMES.staleRecordIngestedAt,
    attemptIds: [],
  }),
  // NOTE: a grade posted after the stale student's audit ran; the audit doesn't reflect it.
  snapshot({
    id: SNAPSHOT.staleNewer,
    studentId: STALE_STUDENT,
    sourceEffectiveAt: SEED_RECORD_TIMES.currentRecordEffectiveAt,
    ingestedAt: SEED_RECORD_TIMES.currentRecordIngestedAt,
    attemptIds: [ATTEMPT.staleStudentMath101],
  }),
];

/** Fields every seeded requirement shares unless it sets them. */
const CHILD_REQUIREMENT = {
  parentSourceRequirementId: 'REQ-DEMO-BS',
  allocatedAttemptIds: [],
  remainingCreditsHundredths: null,
  remainingCourseCount: null,
  candidateCourseIds: [],
  isReusable: false,
} as const;

/**
 * Builds the top-level requirement of an audit.
 *
 * @param auditVersion - The audit's version, used in the source reference.
 * @param remainingCourseCount - Courses still needed.
 * @returns The requirement input.
 */
function degreeRoot(auditVersion: string, remainingCourseCount: number) {
  return {
    ...CHILD_REQUIREMENT,
    sourceRequirementId: 'REQ-DEMO-BS',
    parentSourceRequirementId: null,
    label: 'Demo B.S. requirements',
    state: RequirementState.Incomplete,
    remainingCourseCount,
    sourceRef: `${auditVersion}:REQ-DEMO-BS`,
  };
}

/** Audit fields both seeded audits share. */
const AUDIT_BASE = {
  tenantId: SEED_TENANT_ID,
  programId: PROGRAM,
  auditSource: 'demo-audit',
  catalogYear: CATALOG_YEAR,
} as const;

const AUDITS: readonly AuditSnapshot[] = [
  createAuditSnapshot({
    ...AUDIT_BASE,
    id: seedId('70000000', 1),
    studentId: CURRENT_STUDENT,
    // SAFETY: pinned to the student's only snapshot, on the same program and catalog, so the
    // happy path shows neither AUDIT_STALE nor AUDIT_PROGRAM_MISMATCH.
    studentSnapshotId: SNAPSHOT.current,
    auditVersion: 'audit_demo_r1',
    generatedAt: SEED_RECORD_TIMES.currentAuditGeneratedAt,
    studentRecordEffectiveAt: SEED_RECORD_TIMES.currentRecordEffectiveAt,
    requirements: [
      degreeRoot('audit_demo_r1', 2),
      {
        ...CHILD_REQUIREMENT,
        sourceRequirementId: 'REQ-MATH-CORE',
        label: 'Mathematics core',
        state: RequirementState.Complete,
        allocatedAttemptIds: [ATTEMPT.math101Repeat],
        remainingCreditsHundredths: 0,
        candidateCourseIds: [SEED_CATALOG.math101.id],
        sourceRef: 'audit_demo_r1:REQ-MATH-CORE',
      },
      {
        ...CHILD_REQUIREMENT,
        sourceRequirementId: 'REQ-PHYS-SEQ',
        label: 'Physics sequence',
        state: RequirementState.InProgress,
        allocatedAttemptIds: [ATTEMPT.phys201InProgress],
        remainingCourseCount: 1,
        candidateCourseIds: [SEED_CATALOG.phys201.id, SEED_CATALOG.phys301.id],
        sourceRef: 'audit_demo_r1:REQ-PHYS-SEQ',
      },
      {
        ...CHILD_REQUIREMENT,
        sourceRequirementId: 'REQ-ELECTIVES',
        label: 'Electives',
        state: RequirementState.Incomplete,
        remainingCreditsHundredths: 300,
        candidateCourseIds: [
          SEED_CATALOG.engl101.id,
          SEED_CATALOG.ind390.id,
          SEED_CATALOG.math102.id,
        ],
        sourceRef: 'audit_demo_r1:REQ-ELECTIVES',
      },
    ],
  }),
  createAuditSnapshot({
    ...AUDIT_BASE,
    id: seedId('70000000', 2),
    studentId: STALE_STUDENT,
    // SAFETY: deliberately pinned to the older snapshot; the newer one makes this audit stale.
    studentSnapshotId: SNAPSHOT.staleOlder,
    auditVersion: 'audit_demo_r2',
    generatedAt: SEED_RECORD_TIMES.staleAuditGeneratedAt,
    studentRecordEffectiveAt: SEED_RECORD_TIMES.staleRecordEffectiveAt,
    requirements: [degreeRoot('audit_demo_r2', 3)],
  }),
];

/** The fixed, fully synthetic academic seed. Every code and ID is fictional. */
export const DEV_SEED_ACADEMIC_PLAN: DevSeedAcademicPlan = {
  courses: Object.values(SEED_CATALOG),
  rules: SEED_RULES,
  policy: SEED_POLICY,
  terms: SEED_TERMS,
  attempts: ATTEMPTS,
  snapshots: SNAPSHOTS,
  audits: AUDITS,
};
