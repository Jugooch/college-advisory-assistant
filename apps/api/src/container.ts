/**
 * @file Composition root. The only file that constructs repositories, services, and controllers.
 * @module @caa/api/container
 */
import {
  type AcademicPolicyRepository,
  type AdvisorAssignmentRepository,
  type AuditSnapshotRepository,
  type CampusRepository,
  type CampusTransitionRepository,
  type CourseCatalogRepository,
  createAcademicPolicyRepository,
  createAdvisorAssignmentRepository,
  createAuditSnapshotRepository,
  createCampusRepository,
  createCampusTransitionRepository,
  createCourseCatalogRepository,
  createDatabase,
  createPlanRepository,
  createPrerequisiteRuleRepository,
  createProgramRepository,
  createSectionSnapshotRepository,
  createStudentRepository,
  createStudentSnapshotRepository,
  createTermRepository,
  createUserIdentityRepository,
  type PlanRepository,
  type PrerequisiteRuleRepository,
  type ProgramRepository,
  type StudentRepository,
  type StudentSnapshotRepository,
  type StudentUserLinkRepository,
  type TermRepository,
  type TermSectionSnapshotRepository,
  type UserIdentityRepository,
} from '@caa/db';

import { type ApiEnv, AuthMode } from './config/env';
import {
  type AcademicSummaryController,
  createAcademicSummaryController,
} from './modules/academic-summary/academic-summary.controller';
import { createAcademicSummaryService } from './modules/academic-summary/academic-summary.service';
import { type AccessService, createAccessService } from './modules/access/access.service';
import {
  type CourseChecksController,
  createCourseChecksController,
} from './modules/course-checks/course-checks.controller';
import { createCourseChecksService } from './modules/course-checks/course-checks.service';
import { createCourseSetInputsService } from './modules/course-set-inputs/course-set-inputs.service';
import { createHealthController, type HealthController } from './modules/health/health.controller';
import { createHealthService } from './modules/health/health.service';
import { createPinnedRecordsService } from './modules/pinned-records/pinned-records.service';
import { createPinnedSectionsService } from './modules/pinned-sections/pinned-sections.service';
import { createPlanDraftsController } from './modules/plan-drafts/plan-drafts.controller';
import { createPlanDraftsService } from './modules/plan-drafts/plan-drafts.service';
import { createPlanFreshnessService } from './modules/plan-freshness/plan-freshness.service';
import { createPlanViewsService } from './modules/plan-views/plan-views.service';
import {
  createPlannableTermsController,
  type PlannableTermsController,
} from './modules/plannable-terms/plannable-terms.controller';
import { createPlannableTermsService } from './modules/plannable-terms/plannable-terms.service';
import {
  createScheduleOptionsController,
  type ScheduleOptionsController,
} from './modules/schedule-options/schedule-options.controller';
import { createScheduleOptionsService } from './modules/schedule-options/schedule-options.service';
import {
  createSessionController,
  type SessionController,
} from './modules/session/session.controller';
import {
  createDenyAllSessionResolver,
  createDevSessionResolver,
  createSessionService,
  type SessionResolver,
} from './modules/session/session.service';
import {
  createStudentsController,
  type StudentsController,
} from './modules/students/students.controller';
import { createStudentsService, type StudentsService } from './modules/students/students.service';

/** Every controller the app registers. */
export interface Controllers {
  readonly health: HealthController;
  readonly session: SessionController;
  readonly students: StudentsController;
  readonly academicSummary: AcademicSummaryController;
  readonly courseChecks: CourseChecksController;
  readonly scheduleOptions: ScheduleOptionsController;
  readonly plannableTerms: PlannableTermsController;
  readonly planDrafts: ReturnType<typeof createPlanDraftsController>;
}

/** Every repository the API reads through. Tests pass in-memory fakes. */
export interface Repositories {
  readonly userIdentities: UserIdentityRepository;
  readonly students: StudentRepository;
  /** Finds a signed-in user's own student record, for `GET /v1/me`. */
  readonly studentUserLinks: StudentUserLinkRepository;
  readonly advisorAssignments: AdvisorAssignmentRepository;
  readonly studentSnapshots: StudentSnapshotRepository;
  readonly auditSnapshots: AuditSnapshotRepository;
  readonly courseCatalog: CourseCatalogRepository;
  readonly programs: ProgramRepository;
  readonly prerequisiteRules: PrerequisiteRuleRepository;
  readonly academicPolicies: AcademicPolicyRepository;
  readonly terms: TermRepository;
  readonly sectionSnapshots: TermSectionSnapshotRepository;
  readonly campusTransitions: CampusTransitionRepository;
  readonly campuses: CampusRepository;
  readonly plans: PlanRepository;
}

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

/**
 * Builds the plan drafts controller: saves replay schedule options, and reads derive freshness.
 *
 * @param options - Configuration, repositories, and clock.
 * @param access - The access rule, including who may author a plan.
 * @param scheduleOptions - The existing schedule options service the save replays.
 * @returns The plan drafts controller.
 */
function createPlanControllers(
  options: ContainerOptions,
  access: AccessService,
  scheduleOptions: ReturnType<typeof createScheduleOptionsService>,
): Controllers['planDrafts'] {
  const { env, repositories, now } = options;
  const planViews = createPlanViewsService({
    access,
    plans: repositories.plans,
    freshness: createPlanFreshnessService({
      ...repositories,
      now,
      maxSourceAgeMs: env.ACADEMIC_SOURCE_MAX_AGE_MS,
      rulesetVersion: env.ACTIVE_RULESET_VERSION ?? null,
    }),
  });
  const planDraftsService = createPlanDraftsService({
    ...repositories,
    access,
    scheduleOptions,
    views: planViews,
    now,
  });
  return createPlanDraftsController(planDraftsService, planViews);
}

/**
 * Builds the controllers of the academic reads and plan drafts: summary, course checks,
 * schedule options, and saved plans.
 *
 * @param options - Configuration, repositories, and clock.
 * @param access - The access rule: students for reads, and the plan authoring rule.
 * @returns The academic controllers.
 */
function createAcademicControllers(
  options: ContainerOptions,
  access: { readonly students: StudentsService; readonly service: AccessService },
): Pick<Controllers, 'academicSummary' | 'courseChecks' | 'scheduleOptions' | 'planDrafts'> {
  const studentsService = access.students;
  const { env, repositories, now } = options;
  const pinnedRecords = createPinnedRecordsService({
    studentSnapshots: repositories.studentSnapshots,
    auditSnapshots: repositories.auditSnapshots,
    now,
    maxSourceAgeMs: env.ACADEMIC_SOURCE_MAX_AGE_MS,
  });
  const academicSummaryService = createAcademicSummaryService({
    students: studentsService,
    pinnedRecords,
    maxSkewMs: env.AUDIT_RECORD_MAX_SKEW_MS,
    courseCatalog: repositories.courseCatalog,
    programs: repositories.programs,
  });
  const courseSetInputs = createCourseSetInputsService({
    courseCatalog: repositories.courseCatalog,
    prerequisiteRules: repositories.prerequisiteRules,
    academicPolicies: repositories.academicPolicies,
    terms: repositories.terms,
    students: studentsService,
    pinnedRecords,
    pinnedSections: createPinnedSectionsService({
      sectionSnapshots: repositories.sectionSnapshots,
      campusTransitions: repositories.campusTransitions,
      pinnedRecords,
    }),
    maxSkewMs: env.AUDIT_RECORD_MAX_SKEW_MS,
    rulesetVersion: env.ACTIVE_RULESET_VERSION ?? null,
  });
  const scheduleOptionsService = createScheduleOptionsService({
    courseSetInputs,
    campuses: repositories.campuses,
    now,
    workCap: env.SCHEDULE_SOLVER_WORK_CAP,
  });
  return {
    academicSummary: createAcademicSummaryController(academicSummaryService),
    courseChecks: createCourseChecksController(createCourseChecksService({ courseSetInputs })),
    scheduleOptions: createScheduleOptionsController(scheduleOptionsService),
    planDrafts: createPlanControllers(options, access.service, scheduleOptionsService),
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
  const healthService = createHealthService({
    version: env.APP_VERSION,
    now,
    authMode: env.AUTH_MODE,
  });
  const accessService = createAccessService({
    students: repositories.students,
    advisorAssignments: repositories.advisorAssignments,
    now,
  });
  const studentsService = createStudentsService({
    access: accessService,
    students: repositories.students,
  });
  return {
    controllers: {
      health: createHealthController(healthService),
      session: createSessionController(
        createSessionService({ studentUserLinks: repositories.studentUserLinks }),
      ),
      students: createStudentsController(studentsService),
      ...createAcademicControllers(options, { students: studentsService, service: accessService }),
      plannableTerms: createPlannableTermsController(
        createPlannableTermsService({
          access: accessService,
          sectionSnapshots: repositories.sectionSnapshots,
          now,
          maxSourceAgeMs: env.ACADEMIC_SOURCE_MAX_AGE_MS,
        }),
      ),
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
  // NOTE: one student repository serves both the record reads and the user link.
  const students = createStudentRepository(db);
  const repositories: Repositories = {
    userIdentities: createUserIdentityRepository(db),
    students,
    studentUserLinks: students,
    advisorAssignments: createAdvisorAssignmentRepository(db),
    studentSnapshots: createStudentSnapshotRepository(db),
    auditSnapshots: createAuditSnapshotRepository(db),
    courseCatalog: createCourseCatalogRepository(db),
    programs: createProgramRepository(db),
    prerequisiteRules: createPrerequisiteRuleRepository(db),
    academicPolicies: createAcademicPolicyRepository(db),
    terms: createTermRepository(db),
    sectionSnapshots: createSectionSnapshotRepository(db),
    campusTransitions: createCampusTransitionRepository(db),
    campuses: createCampusRepository(db),
    plans: createPlanRepository(db),
  };
  return createContainer({ env, repositories, now: () => new Date() });
}
