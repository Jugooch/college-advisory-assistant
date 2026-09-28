/**
 * @file Test-only entry point (`@caa/api/testing`) that lets cross-package tests assemble the app.
 * @module @caa/api/testing
 * @see docs/standards/01-repository-structure.md
 *
 * For tests only. The production bundle is built from `server.ts` alone and never includes this
 * file, so nothing here is shipped or run by the deployed API.
 */
export { buildApp, type BuildAppOptions } from './app';
export { type ApiEnv, AuthMode, loadApiEnv } from './config/env';
export {
  type AppDependencies,
  type ContainerOptions,
  type Controllers,
  createContainer,
  type Repositories,
} from './container';
export type { DevTokenIdentity } from './modules/session/session.service';
export type { LogDestination, Logger } from './shared/logger';
export type { RequestContext } from './shared/request-context';
export type {
  AcademicPolicyRepository,
  AdvisorAssignmentRepository,
  AuditSnapshotRepository,
  CourseCatalogRepository,
  LatestAuditSnapshot,
  LatestStudentSnapshot,
  PrerequisiteRuleRepository,
  StudentRepository,
  StudentSnapshotRepository,
  StudentSnapshotRevision,
  TermRepository,
  UserIdentityRepository,
} from '@caa/db';
