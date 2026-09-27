/**
 * @file Composition root. The only file that constructs repositories, services, and controllers.
 * @module @caa/api/container
 */
import {
  type AdvisorAssignmentRepository,
  createAdvisorAssignmentRepository,
  createDatabase,
  createStudentRepository,
  createUserIdentityRepository,
  type StudentRepository,
  type UserIdentityRepository,
} from '@caa/db';

import { type ApiEnv, AuthMode } from './config/env';
import { createAccessService } from './modules/access/access.service';
import { createHealthController, type HealthController } from './modules/health/health.controller';
import { createHealthService } from './modules/health/health.service';
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
}

/** Every repository the API reads through. Tests pass in-memory fakes. */
export interface Repositories {
  readonly userIdentities: UserIdentityRepository;
  readonly students: StudentRepository;
  readonly advisorAssignments: AdvisorAssignmentRepository;
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
  return {
    controllers: {
      health: createHealthController(healthService),
      session: createSessionController(),
      students: createStudentsController(studentsService),
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
  };
  return createContainer({ env, repositories, now: () => new Date() });
}
