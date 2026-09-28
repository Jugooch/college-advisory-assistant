/**
 * @file Composition root. The only file that constructs repositories, services, and controllers.
 * @module @caa/api/container
 */
import {
  type AcademicPolicyRepository,
  type AdvisorAssignmentRepository,
  type AuditSnapshotRepository,
  type CourseCatalogRepository,
  createAcademicPolicyRepository,
  createAdvisorAssignmentRepository,
  createAuditSnapshotRepository,
  createCourseCatalogRepository,
  createDatabase,
  createPrerequisiteRuleRepository,
  createStudentRepository,
  createStudentSnapshotRepository,
  createTermRepository,
  createUserIdentityRepository,
  type PrerequisiteRuleRepository,
  type StudentRepository,
  type StudentSnapshotRepository,
  type TermRepository,
  type UserIdentityRepository,
} from '@caa/db';

import { type ApiEnv, AuthMode } from './config/env';
import {
  type AcademicSummaryController,
  createAcademicSummaryController,
} from './modules/academic-summary/academic-summary.controller';
import { createAcademicSummaryService } from './modules/academic-summary/academic-summary.service';
import { createAccessService } from './modules/access/access.service';
import {
  type CourseChecksController,
  createCourseChecksController,
} from './modules/course-checks/course-checks.controller';
import { createCourseChecksService } from './modules/course-checks/course-checks.service';
import { createHealthController, type HealthController } from './modules/health/health.controller';
import { createHealthService } from './modules/health/health.service';
import { createPinnedRecordsService } from './modules/pinned-records/pinned-records.service';
import {
  createSessionController,
  type SessionController,
} from './modules/session/session.controller';
import {
  createDenyAllSessionResolver,
  createDevSessionResolver,
  type SessionResolver,
} from './modules/session/session.service';
import {
  createStudentsController,
  type StudentsController,
} from './modules/students/students.controller';
import { createStudentsService } from './modules/students/students.service';

/** Every controller the app registers. */
export interface Controllers {
  readonly health: HealthController;
  readonly session: SessionController;
  readonly students: StudentsController;
  readonly academicSummary: AcademicSummaryController;
  readonly courseChecks: CourseChecksController;
}

/** Every repository the API reads through. Tests pass in-memory fakes. */
export interface Repositories {
  readonly userIdentities: UserIdentityRepository;
  readonly students: StudentRepository;
  readonly advisorAssignments: AdvisorAssignmentRepository;
  /**
   * Student record snapshots. Optional only so harnesses that serve no academic data can omit
   * it; the runtime always wires it, and a missing one fails every read that needs it.
   */
  readonly studentSnapshots?: StudentSnapshotRepository;
  /** Degree audit snapshots. Optional for the same reason as `studentSnapshots`. */
  readonly auditSnapshots?: AuditSnapshotRepository;
  /** Course catalogs. Optional for the same reason as `studentSnapshots`. */
  readonly courseCatalog?: CourseCatalogRepository;
  /** Prerequisite rules. Optional for the same reason as `studentSnapshots`. */
  readonly prerequisiteRules?: PrerequisiteRuleRepository;
  /** Academic policies. Optional for the same reason as `studentSnapshots`. */
  readonly academicPolicies?: AcademicPolicyRepository;
  /** Term calendars. Optional for the same reason as `studentSnapshots`. */
  readonly terms?: TermRepository;
}

/** The optional academic repositories, each filled in. */
type AcademicRepositories = Required<
  Pick<
    Repositories,
    | 'studentSnapshots'
    | 'auditSnapshots'
    | 'courseCatalog'
    | 'prerequisiteRules'
    | 'academicPolicies'
    | 'terms'
  >
>;

/** What {@link createContainer} needs. */
export interface ContainerOptions {
  readonly env: ApiEnv;
  readonly repositories: Repositories;
  /** Returns the current time. */
  readonly now: () => Date;
}

/** Everything the app needs to register its routes. */
export interface AppDependencies {
  readonly controllers: Controllers;
  readonly sessionResolver: SessionResolver;
}

/**
 * Picks the session resolver for the configured auth mode.
 *
 * @param env - Validated configuration.
 * @param identities - User identity repository.
 * @returns The dev resolver when `AUTH_MODE=dev`, otherwise one that denies every token.
 */
function createSessionResolver(env: ApiEnv, identities: UserIdentityRepository): SessionResolver {
  // SECURITY: env validation already refuses AUTH_MODE=dev in production.
  return env.AUTH_MODE === AuthMode.Dev
    ? createDevSessionResolver({ tokens: env.DEV_AUTH_TOKENS, identities })
    : createDenyAllSessionResolver();
}

/** Thrown when a read needs a repository the container wasn't given. */
class RepositoryNotConfiguredError extends Error {
  /** Creates the error. */
  constructor() {
    super('A repository this endpoint needs is not configured');
    this.name = 'RepositoryNotConfiguredError';
  }
}

/**
 * Rejects a read whose repository wasn't configured.
 *
 * @returns A rejected promise, which the error handler turns into INTERNAL_ERROR.
 */
function rejectNotConfigured(): Promise<never> {
  return Promise.reject(new RepositoryNotConfiguredError());
}

/**
 * Fills in the optional academic repositories with ones that fail every read.
 *
 * @param repositories - The given repositories.
 * @returns Every academic repository.
 */
function academicRepositories(repositories: Repositories): AcademicRepositories {
  // SAFETY: a missing repository fails closed (500); it never reads as "no record", "no audit",
  // "no rule", or an empty catalog.
  return {
    studentSnapshots: repositories.studentSnapshots ?? {
      findLatest: rejectNotConfigured,
      findById: rejectNotConfigured,
    },
    auditSnapshots: repositories.auditSnapshots ?? { findLatest: rejectNotConfigured },
    courseCatalog: repositories.courseCatalog ?? { findCatalog: rejectNotConfigured },
    prerequisiteRules: repositories.prerequisiteRules ?? { findRule: rejectNotConfigured },
    academicPolicies: repositories.academicPolicies ?? { findPolicy: rejectNotConfigured },
    terms: repositories.terms ?? { findOrdered: rejectNotConfigured },
  };
}

/**
 * Builds the dependency graph from the given repositories and clock.
 *
 * @param options - Configuration, repositories, and clock.
 * @returns The controllers and the session resolver.
 */
export function createContainer(options: ContainerOptions): AppDependencies {
  const { env, repositories, now } = options;
  const healthService = createHealthService({ version: env.APP_VERSION, now });
  const accessService = createAccessService({
    students: repositories.students,
    advisorAssignments: repositories.advisorAssignments,
    now,
  });
  const studentsService = createStudentsService({
    access: accessService,
    students: repositories.students,
  });
  const academic = academicRepositories(repositories);
  const pinnedRecords = createPinnedRecordsService(academic);
  const academicSummaryService = createAcademicSummaryService({
    students: studentsService,
    pinnedRecords,
    maxSkewMs: env.AUDIT_RECORD_MAX_SKEW_MS,
  });
  const courseChecksService = createCourseChecksService({
    ...academic,
    students: studentsService,
    pinnedRecords,
    maxSkewMs: env.AUDIT_RECORD_MAX_SKEW_MS,
    rulesetVersion: env.ACTIVE_RULESET_VERSION ?? null,
  });
  return {
    controllers: {
      health: createHealthController(healthService),
      session: createSessionController(),
      students: createStudentsController(studentsService),
      academicSummary: createAcademicSummaryController(academicSummaryService),
      courseChecks: createCourseChecksController(courseChecksService),
    },
    sessionResolver: createSessionResolver(env, repositories.userIdentities),
  };
}

/**
 * Builds the production dependency graph: PostgreSQL repositories and the system clock.
 *
 * @param env - Validated configuration.
 * @returns The controllers and the session resolver.
 */
export function createRuntimeDependencies(env: ApiEnv): AppDependencies {
  const db = createDatabase(env.DATABASE_URL);
  const repositories: Repositories = {
    userIdentities: createUserIdentityRepository(db),
    students: createStudentRepository(db),
    advisorAssignments: createAdvisorAssignmentRepository(db),
    studentSnapshots: createStudentSnapshotRepository(db),
    auditSnapshots: createAuditSnapshotRepository(db),
    courseCatalog: createCourseCatalogRepository(db),
    prerequisiteRules: createPrerequisiteRuleRepository(db),
    academicPolicies: createAcademicPolicyRepository(db),
    terms: createTermRepository(db),
  };
  return createContainer({ env, repositories, now: () => new Date() });
}
