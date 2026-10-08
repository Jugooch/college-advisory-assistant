/**
 * @file Composition root for the session, the access rule, and student reads.
 * @module @caa/api/wiring/access
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import { type ApiEnv, AuthMode } from '../config/env';
import type { ContainerOptions } from '../container';
import { type AccessService, createAccessService } from '../modules/access/access.service';
import {
  createSessionController,
  type SessionController,
} from '../modules/session/session.controller';
import {
  createDenyAllSessionResolver,
  createDevSessionResolver,
  createSessionService,
  type SessionResolver,
} from '../modules/session/session.service';
import {
  createStudentsController,
  type StudentsController,
} from '../modules/students/students.controller';
import { createStudentsService, type StudentsService } from '../modules/students/students.service';

/** What {@link wireAccess} builds: the session and student controllers and the shared services. */
export interface AccessWiring {
  readonly session: SessionController;
  readonly students: StudentsController;
  /** The access rule every other area applies. */
  readonly access: AccessService;
  /** Student reads, which every academic read starts with. */
  readonly studentsService: StudentsService;
  readonly sessionResolver: SessionResolver;
}

/**
 * Picks the session resolver for the configured auth mode.
 *
 * @param env - Validated configuration.
 * @param identities - User identity repository.
 * @returns The dev resolver when `AUTH_MODE=dev`, otherwise one that denies every token.
 */
function chooseSessionResolver(
  env: ApiEnv,
  identities: ContainerOptions['repositories']['userIdentities'],
): SessionResolver {
  // SECURITY: env validation already refuses AUTH_MODE=dev in production.
  return env.AUTH_MODE === AuthMode.Dev
    ? createDevSessionResolver({ tokens: env.DEV_AUTH_TOKENS, identities })
    : createDenyAllSessionResolver();
}

/**
 * Builds the session, access, and students services and their controllers.
 *
 * @param options - Configuration, repositories, and clock.
 * @returns The controllers, the access and students services, and the session resolver.
 */
export function wireAccess(options: ContainerOptions): AccessWiring {
  const { env, repositories, now } = options;
  const access = createAccessService({
    students: repositories.students,
    advisorAssignments: repositories.advisorAssignments,
    now,
  });
  const studentsService = createStudentsService({ access, students: repositories.students });
  return {
    session: createSessionController(
      createSessionService({ studentUserLinks: repositories.studentUserLinks }),
    ),
    students: createStudentsController(studentsService),
    access,
    studentsService,
    sessionResolver: chooseSessionResolver(env, repositories.userIdentities),
  };
}
