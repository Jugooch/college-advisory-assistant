/**
 * @file In-memory copy of the dev seed's academic data (#127) for SYN-000001 and SYN-000002, so
 * service tests can check the README "Try the seeded academic scenarios" expectations.
 * @module @caa/api/testing/seed-scenario-fixtures
 * @see packages/db/src/seed/dev-seed-academic-catalog.ts
 * @see packages/db/src/seed/dev-seed-academic-plan.ts
 * @see docs/standards/07-testing.md
 */
import {
  type Course,
  createAuditSnapshot,
  createStudentSnapshot,
  createTermCalendar,
  LetterGrade,
  type PrerequisiteRule,
  RepeatPolicy,
  RequirementState,
  type StudentSnapshot,
} from '@caa/domain';
import {
  all,
  any,
  buildAcademicPolicy,
  buildCourse,
  buildPrerequisiteRule,
  buildStudent,
  completedAttempt,
  course,
  inProgressAttempt,
  letter,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import type { InMemoryAcademicStore } from './in-memory-academic-repositories';

/** The seed's one ruleset version. */
export const SEED_RULESET = 'demo-2026.1';

/** SYN-000001 (happy path) and SYN-000002 (stale audit), as the seed writes them. */
export const SEED_STUDENTS = {
  current: buildStudent({}, 1),
  stale: buildStudent({}, 2),
} as const;

/**
 * Builds a seeded catalog course: same ID, label, and credits as the seed, no equivalents.
 *
 * @param seed - Number in the course ID.
 * @param label - Display label such as `DEMO-MATH 101`.
 * @param credits - Fixed credits in hundredths, or a variable `[min, max]` range.
 * @returns The course.
 */
function seedCourse(
  seed: number,
  label: string,
  credits: number | readonly [number, number],
): Course {
  const isFixed = typeof credits === 'number';
  return buildCourse(
    {
      label,
      sourceCourseId: label.replace(' ', '-'),
      creditsHundredths: isFixed ? credits : null,
      minCreditsHundredths: isFixed ? null : credits[0],
      maxCreditsHundredths: isFixed ? null : credits[1],
    },
    seed,
  );
}

/** The seeded catalog, by key. */
export const SEED_COURSES = {
  math101: seedCourse(0x101, 'DEMO-MATH 101', 300),
  math102: seedCourse(0x102, 'DEMO-MATH 102', 300),
  phys201: seedCourse(0x201, 'DEMO-PHYS 201', 400),
  phys301: seedCourse(0x301, 'DEMO-PHYS 301', 400),
  phys301Lab: seedCourse(0x3010, 'DEMO-PHYS 301L', 100),
  engl101: seedCourse(0x1101, 'DEMO-ENGL 101', 300),
  ind390: seedCourse(0x390, 'DEMO-IND 390', [100, 300]),
} as const;

const { math101, math102, phys201, phys301 } = SEED_COURSES;

/**
 * Builds a seeded prerequisite rule.
 *
 * @param target - Course the rule is for.
 * @param expression - Its expression.
 * @returns The rule.
 */
function seedRule(target: Course, expression: PrerequisiteRule['expression']): PrerequisiteRule {
  return buildPrerequisiteRule({
    courseId: target.id,
    expression,
    sourceRef: `demo-catalog-rule:${target.sourceCourseId}`,
    rulesetVersion: SEED_RULESET,
  });
}

const C = letter('C');

/**
 * Builds one seeded term.
 *
 * @param sequence - Position in the calendar; also the number in the term ID.
 * @param termCode - Term code such as `2026FA`.
 * @param dates - First and last day, `YYYY-MM-DD`.
 * @returns The term input.
 */
function seedTerm(sequence: number, termCode: string, dates: readonly [string, string]) {
  const [startsOn, endsOn] = dates;
  const id = `b0000000-0000-4000-8000-${sequence.toString(16).padStart(12, '0')}`;
  return { id, tenantId: SYNTHETIC_TENANTS.a.id, termCode, startsOn, endsOn, sequence };
}

/** The seeded term calendar, oldest first. */
export const SEED_TERMS = createTermCalendar([
  seedTerm(1, '2025FA', ['2025-08-25', '2025-12-19']),
  seedTerm(2, '2026SP', ['2026-01-12', '2026-05-08']),
  seedTerm(3, '2026FA', ['2026-08-24', '2026-12-18']),
  seedTerm(4, '2027SP', ['2027-01-11', '2027-05-07']),
]);
const PROGRAM_ID = syntheticId('program', 1);

/** The seeded attempts: SYN-000001's three, then SYN-000002's one. */
export const SEED_ATTEMPTS = [
  completedAttempt(
    {
      courseId: math101.id,
      termCode: '2025FA',
      grade: letter('D'),
      sourceAttemptId: 'SYN-ATT-0001',
    },
    1,
  ),
  completedAttempt(
    {
      courseId: math101.id,
      termCode: '2026SP',
      grade: letter('B'),
      sourceAttemptId: 'SYN-ATT-0002',
    },
    2,
  ),
  inProgressAttempt(
    { courseId: phys201.id, termCode: '2026FA', sourceAttemptId: 'SYN-ATT-0003' },
    3,
  ),
  completedAttempt(
    {
      studentId: SEED_STUDENTS.stale.id,
      courseId: math101.id,
      termCode: '2026SP',
      grade: letter('A'),
      sourceAttemptId: 'SYN-ATT-0004',
    },
    4,
  ),
] as const;

/**
 * Builds a seeded snapshot on the seeded program and catalog.
 *
 * @param seed - Number in the snapshot ID.
 * @param fields - Student, source time, ingestion time, and attempts.
 * @returns The snapshot.
 */
function seedSnapshot(
  seed: number,
  fields: Pick<StudentSnapshot, 'studentId' | 'sourceEffectiveAt' | 'ingestedAt' | 'attemptIds'>,
): StudentSnapshot {
  return createStudentSnapshot({
    id: syntheticId('studentSnapshot', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    ...fields,
  });
}

/** The seeded snapshots: SYN-000001's, and SYN-000002's older and newer ones. */
export const SEED_SNAPSHOTS = {
  current: seedSnapshot(1, {
    studentId: SEED_STUDENTS.current.id,
    sourceEffectiveAt: '2026-09-01T05:00:00.000Z',
    ingestedAt: '2026-09-01T06:00:00.000Z',
    attemptIds: [SEED_ATTEMPTS[0].id, SEED_ATTEMPTS[1].id, SEED_ATTEMPTS[2].id],
  }),
  staleOlder: seedSnapshot(2, {
    studentId: SEED_STUDENTS.stale.id,
    sourceEffectiveAt: '2026-08-15T05:00:00.000Z',
    ingestedAt: '2026-08-15T06:00:00.000Z',
    attemptIds: [],
  }),
  staleNewer: seedSnapshot(3, {
    studentId: SEED_STUDENTS.stale.id,
    sourceEffectiveAt: '2026-09-01T05:00:00.000Z',
    ingestedAt: '2026-09-01T06:00:00.000Z',
    attemptIds: [SEED_ATTEMPTS[3].id],
  }),
} as const;

/** Requirement fields the seeded child requirements share. */
const CHILD = {
  parentSourceRequirementId: 'REQ-DEMO-BS',
  allocatedAttemptIds: [],
  remainingCreditsHundredths: null,
  remainingCourseCount: null,
  candidateCourseIds: [],
  isReusable: false,
} as const;

/**
 * Builds the seeded degree root requirement.
 *
 * @param auditVersion - The audit's version, used in the source reference.
 * @param remainingCourseCount - Courses still needed.
 * @returns The requirement input.
 */
function degreeRoot(auditVersion: string, remainingCourseCount: number) {
  return {
    ...CHILD,
    sourceRequirementId: 'REQ-DEMO-BS',
    parentSourceRequirementId: null,
    label: 'Demo B.S. requirements',
    state: RequirementState.Incomplete,
    remainingCourseCount,
    sourceRef: `${auditVersion}:REQ-DEMO-BS`,
  };
}

const AUDIT_BASE = {
  tenantId: SYNTHETIC_TENANTS.a.id,
  programId: PROGRAM_ID,
  auditSource: 'demo-audit',
  catalogYear: '2025-2026',
} as const;

/** The seeded audits: SYN-000001's current one, and SYN-000002's stale one. */
export const SEED_AUDITS = {
  current: createAuditSnapshot({
    ...AUDIT_BASE,
    id: syntheticId('audit', 1),
    studentId: SEED_STUDENTS.current.id,
    studentSnapshotId: SEED_SNAPSHOTS.current.id,
    auditVersion: 'audit_demo_r1',
    generatedAt: '2026-09-01T07:00:00.000Z',
    studentRecordEffectiveAt: '2026-09-01T05:00:00.000Z',
    requirements: [
      degreeRoot('audit_demo_r1', 2),
      {
        ...CHILD,
        sourceRequirementId: 'REQ-MATH-CORE',
        label: 'Mathematics core',
        state: RequirementState.Complete,
        allocatedAttemptIds: [SEED_ATTEMPTS[1].id],
        remainingCreditsHundredths: 0,
        candidateCourseIds: [math101.id],
        sourceRef: 'audit_demo_r1:REQ-MATH-CORE',
      },
      {
        ...CHILD,
        sourceRequirementId: 'REQ-PHYS-SEQ',
        label: 'Physics sequence',
        state: RequirementState.InProgress,
        allocatedAttemptIds: [SEED_ATTEMPTS[2].id],
        remainingCourseCount: 1,
        candidateCourseIds: [phys201.id, phys301.id],
        sourceRef: 'audit_demo_r1:REQ-PHYS-SEQ',
      },
      {
        ...CHILD,
        sourceRequirementId: 'REQ-ELECTIVES',
        label: 'Electives',
        state: RequirementState.Incomplete,
        remainingCreditsHundredths: 300,
        candidateCourseIds: [SEED_COURSES.engl101.id, SEED_COURSES.ind390.id, math102.id],
        sourceRef: 'audit_demo_r1:REQ-ELECTIVES',
      },
    ],
  }),
  stale: createAuditSnapshot({
    ...AUDIT_BASE,
    id: syntheticId('audit', 2),
    studentId: SEED_STUDENTS.stale.id,
    studentSnapshotId: SEED_SNAPSHOTS.staleOlder.id,
    auditVersion: 'audit_demo_r2',
    generatedAt: '2026-08-15T07:00:00.000Z',
    studentRecordEffectiveAt: '2026-08-15T05:00:00.000Z',
    requirements: [degreeRoot('audit_demo_r2', 3)],
  }),
} as const;

/** The seeded prerequisite rules. DEMO-MATH 101, DEMO-ENGL 101, the lab, and IND 390 have none. */
export const SEED_RULES: readonly PrerequisiteRule[] = [
  seedRule(math102, course(math101.id, C)),
  seedRule(phys201, course(math101.id, C)),
  seedRule(phys301, all(course(phys201.id, C), any(course(math102.id, C), course(math101.id, C)))),
];

/** The seeded policy: in-progress prerequisites allowed, MOST_RECENT repeats, 12.00 to 18.00. */
export const SEED_POLICY = buildAcademicPolicy({
  allowsInProgressPrerequisites: true,
  lowestPassingLetterGrade: LetterGrade.D,
  repeatPolicy: RepeatPolicy.MostRecent,
  termCreditBounds: { minCreditsHundredths: 1200, maxCreditsHundredths: 1800 },
});

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
