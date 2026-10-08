/**
 * @file Builds the Fastify application without starting it, so tests can use `inject`.
 * @module @caa/api/app
 */
import Fastify, { type FastifyInstance } from 'fastify';

import type { AppDependencies } from './container';
import { registerAcademicSummaryRoutes } from './modules/academic-summary/academic-summary.routes';
import { registerCaseActionsRoutes } from './modules/case-actions/case-actions.routes';
import { registerCaseQueueRoutes } from './modules/case-queue/case-queue.routes';
import { registerCasesRoutes } from './modules/cases/cases.routes';
import { registerCourseChecksRoutes } from './modules/course-checks/course-checks.routes';
import { registerHealthRoutes } from './modules/health/health.routes';
import { registerPlanDraftsRoutes } from './modules/plan-drafts/plan-drafts.routes';
import { registerPlanRevalidationRoutes } from './modules/plan-revalidation/plan-revalidation.routes';
import { registerPlanViewsRoutes } from './modules/plan-views/plan-views.routes';
import { registerPlannableTermsRoutes } from './modules/plannable-terms/plannable-terms.routes';
import { registerPolicySearchRoutes } from './modules/policy-search/policy-search.routes';
import { registerScheduleOptionsRoutes } from './modules/schedule-options/schedule-options.routes';
import { registerSessionRoutes } from './modules/session/session.routes';
import { registerStudentsRoutes } from './modules/students/students.routes';
import { registerAuthenticatedScope } from './plugins/auth.plugin';
import { registerErrorHandler } from './plugins/error-handler.plugin';
import type { LogDestination } from './shared/logger';

/** Options for {@link buildApp}. */
export interface BuildAppOptions {
  readonly dependencies: AppDependencies;
  /** False disables logging; `{ stream }` writes JSON lines to the given destination. */
  readonly logger: boolean | { readonly stream: LogDestination };
}

/**
 * Creates the configured Fastify instance. Health is public; every other route needs a session.
 *
 * @param options - Dependencies and logger setting.
 * @returns The Fastify instance, not yet listening.
 */
export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger });
  const { controllers, sessionResolver } = options.dependencies;
  registerErrorHandler(app);
  registerHealthRoutes(app, controllers.health);
  registerAuthenticatedScope(app, {
    sessionResolver,
    registerRoutes: (scope) => {
      registerSessionRoutes(scope, controllers.session);
      registerStudentsRoutes(scope, controllers.students);
      registerAcademicSummaryRoutes(scope, controllers.academicSummary);
      registerCourseChecksRoutes(scope, controllers.courseChecks);
      registerScheduleOptionsRoutes(scope, controllers.scheduleOptions);
      registerPlannableTermsRoutes(scope, controllers.plannableTerms);
      registerPlanDraftsRoutes(scope, controllers.planDrafts);
      registerPlanRevalidationRoutes(scope, controllers.planRevalidation);
      registerPlanViewsRoutes(scope, controllers.planViews);
      registerCasesRoutes(scope, controllers.cases);
      registerCaseQueueRoutes(scope, controllers.caseQueue);
      registerCaseActionsRoutes(scope, controllers.caseActions);
      registerPolicySearchRoutes(scope, controllers.policySearch);
    },
  });
  return app;
}
