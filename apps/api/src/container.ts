/**
 * @file Composition root entry point: builds the dependency graph from the per-area
 * `wiring/*.wiring.ts` files. Together they are the only code that constructs repositories,
 * services, and controllers (ADR-0014).
 * @module @caa/api/container
 */
import {
  type AcademicPolicyRepository,
  type AdvisingCaseRepository,
  type AdvisorAssignmentRepository,
  type AuditSnapshotRepository,
  type CampusRepository,
  type CampusTransitionRepository,
  type CourseCatalogRepository,
  createAcademicPolicyRepository,
  createAdvisingCaseRepository,
  createAdvisorAssignmentRepository,
  createAuditSnapshotRepository,
  createCampusRepository,
  createCampusTransitionRepository,
  createCourseCatalogRepository,
  createDatabase,
  createPlanRepository,
  createPolicyDocumentRepository,
  createPrerequisiteRuleRepository,
  createProgramRepository,
  createSectionSnapshotRepository,
  createStudentRepository,
  createStudentSnapshotRepository,
  createTermRepository,
  createUserIdentityRepository,
  type PlanRepository,
  type PolicyDocumentRepository,
  type PrerequisiteRuleRepository,
  type ProgramRepository,
  type StudentRepository,
  type StudentSnapshotRepository,
  type StudentUserLinkRepository,
  type TermRepository,
  type TermSectionSnapshotRepository,
  type UserIdentityRepository,
} from '@caa/db';

import type { ApiEnv } from './config/env';
import type { AcademicSummaryController } from './modules/academic-summary/academic-summary.controller';
import type { CaseActionsController } from './modules/case-actions/case-actions.controller';
import type { CaseQueueController } from './modules/case-queue/case-queue.controller';
import type { CasesController } from './modules/cases/cases.controller';
import type { CourseChecksController } from './modules/course-checks/course-checks.controller';
import { createHealthController, type HealthController } from './modules/health/health.controller';
import { createHealthService } from './modules/health/health.service';
import type { PlanDraftsController } from './modules/plan-drafts/plan-drafts.controller';
import type { PlanRevalidationController } from './modules/plan-revalidation/plan-revalidation.controller';
import type { PlanViewsController } from './modules/plan-views/plan-views.controller';
import type { PlannableTermsController } from './modules/plannable-terms/plannable-terms.controller';
import type { PolicySearchController } from './modules/policy-search/policy-search.controller';
import type { ScheduleOptionsController } from './modules/schedule-options/schedule-options.controller';
import type { SessionController } from './modules/session/session.controller';
import type { SessionResolver } from './modules/session/session.service';
import type { StudentsController } from './modules/students/students.controller';
import { wireAcademic } from './wiring/academic.wiring';
import { wireAccess } from './wiring/access.wiring';
import { wireCases } from './wiring/cases.wiring';
import { wirePlans } from './wiring/plans.wiring';
import { wirePolicy } from './wiring/policy.wiring';

/** Every controller the app registers. */
export interface Controllers {
  readonly health: HealthController;
  readonly session: SessionController;
  readonly students: StudentsController;
  readonly academicSummary: AcademicSummaryController;
  readonly courseChecks: CourseChecksController;
  readonly scheduleOptions: ScheduleOptionsController;
  readonly plannableTerms: PlannableTermsController;
  readonly planDrafts: PlanDraftsController;
  readonly planRevalidation: PlanRevalidationController;
  readonly planViews: PlanViewsController;
  readonly cases: CasesController;
  readonly caseQueue: CaseQueueController;
  readonly caseActions: CaseActionsController;
  readonly policySearch: PolicySearchController;
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
  readonly cases: AdvisingCaseRepository;
  readonly policyDocuments: PolicyDocumentRepository;
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
 * Builds the dependency graph from the given repositories and clock.
 *
 * @param options - Configuration, repositories, and clock.
 * @returns The controllers and the session resolver.
 */
export function createContainer(options: ContainerOptions): AppDependencies {
  const { env, now } = options;
  const access = wireAccess(options);
  const academic = wireAcademic(options, access.studentsService, access.access);
  const plans = wirePlans(options, access.access, academic.scheduleOptionsService);
  const cases = wireCases(options, access.access, plans.views);
  const policy = wirePolicy(options);
  return {
    controllers: {
      health: createHealthController(
        createHealthService({ version: env.APP_VERSION, now, authMode: env.AUTH_MODE }),
      ),
      session: access.session,
      students: access.students,
      academicSummary: academic.academicSummary,
      courseChecks: academic.courseChecks,
      scheduleOptions: academic.scheduleOptions,
      plannableTerms: academic.plannableTerms,
      planDrafts: plans.planDrafts,
      planRevalidation: plans.planRevalidation,
      planViews: plans.planViews,
      ...cases,
      policySearch: policy.policySearch,
    },
    sessionResolver: access.sessionResolver,
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
    cases: createAdvisingCaseRepository(db),
    policyDocuments: createPolicyDocumentRepository(db),
  };
  return createContainer({ env, repositories, now: () => new Date() });
}
