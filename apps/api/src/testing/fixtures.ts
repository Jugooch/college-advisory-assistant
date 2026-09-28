/**
 * @file Shared synthetic world for the HTTP-level tests: one identity per role, plus dev tokens.
 * @module @caa/api/testing/fixtures
 * @see docs/standards/07-testing.md
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ErrorEnvelopeSchema } from '@caa/api-contract';
import { type ErrorCode, IdentityStatus, Role, type Student, type UserIdentity } from '@caa/domain';
import {
  buildAdvisorAssignment,
  buildStudent,
  buildUserIdentity,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import type { Repositories } from '../container';
import type { DevTokenIdentity } from '../modules/session/session.service';
import type { LogDestination } from '../shared/logger';
import { buildRecordAudit, buildRecordSnapshot } from './academic-fixtures';
import type { InMemoryStore } from './in-memory-repositories';
import { buildTestApp } from './test-app';

/** Fixed instant every HTTP test runs at. */
export const TEST_NOW = new Date('2026-09-01T12:00:00.000Z');

/** Synthetic identities, one per case the routes must handle. */
export const IDENTITIES: Readonly<
  Record<'student' | 'advisor' | 'tenantAdmin' | 'admin' | 'disabled', UserIdentity>
> = {
  student: buildUserIdentity({ roles: [Role.Student] }, 1),
  advisor: buildUserIdentity({ roles: [Role.Advisor] }, 2),
  tenantAdmin: buildUserIdentity({ roles: [Role.Admin] }, 3),
  admin: buildUserIdentity({ tenantId: SYNTHETIC_TENANTS.b.id, roles: [Role.Admin] }, 4),
  disabled: buildUserIdentity({ status: IdentityStatus.Disabled }, 5),
};

/** Synthetic students in tenant A: the signed-in student's own record, and an unassigned one. */
export const STUDENTS: Readonly<Record<'own' | 'other', Student>> = {
  own: buildStudent({ userId: IDENTITIES.student.id }, 1),
  other: buildStudent({}, 2),
};

/** Dev token for each identity in {@link IDENTITIES}. */
export const TOKENS: Readonly<Record<keyof typeof IDENTITIES, string>> = {
  student: 'dev-token-student',
  advisor: 'dev-token-advisor',
  tenantAdmin: 'dev-token-tenant-admin',
  admin: 'dev-token-admin',
  disabled: 'dev-token-disabled',
};

/**
 * Picks the SSO issuer and subject a dev token stands for.
 *
 * @param identity - Identity to sign in as.
 * @returns The dev token target.
 */
function signInAs(identity: UserIdentity): DevTokenIdentity {
  return { issuer: identity.issuer, subject: identity.subject };
}

/**
 * Builds the app over the synthetic world. The advisor is assigned to the `own` student only.
 * The `own` student has one record snapshot and one audit that reflects it; `other` has neither.
 *
 * @param logStream - Captures JSON log lines. Logging is off when omitted.
 * @param repositoryOverrides - Repositories to use instead of the in-memory ones, for example
 *   one that ignores its tenant filter to test a backstop.
 * @returns The app and its mutable store.
 */
export function buildWorldApp(
  logStream?: LogDestination,
  repositoryOverrides: Partial<Repositories> = {},
): {
  app: FastifyInstance;
  store: InMemoryStore;
} {
  const store: InMemoryStore = {
    identities: Object.values(IDENTITIES),
    students: Object.values(STUDENTS),
    assignments: [
      buildAdvisorAssignment({ advisorUserId: IDENTITIES.advisor.id, studentId: STUDENTS.own.id }),
    ],
    studentSnapshots: [buildRecordSnapshot({ studentId: STUDENTS.own.id })],
    audits: [buildRecordAudit({ studentId: STUDENTS.own.id })],
  };
  const tokens = {
    [TOKENS.student]: signInAs(IDENTITIES.student),
    [TOKENS.advisor]: signInAs(IDENTITIES.advisor),
    [TOKENS.tenantAdmin]: signInAs(IDENTITIES.tenantAdmin),
    [TOKENS.admin]: signInAs(IDENTITIES.admin),
    [TOKENS.disabled]: signInAs(IDENTITIES.disabled),
  };
  const app = buildTestApp({
    store,
    tokens,
    now: () => TEST_NOW,
    repositoryOverrides,
    ...(logStream === undefined ? {} : { logStream }),
  });
  return { app, store };
}

/**
 * Builds an `Authorization` header for a dev token.
 *
 * @param token - Dev token.
 * @returns Headers for `app.inject`.
 */
export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

/** The error envelope with no extra fields at either level. */
const StrictErrorEnvelopeSchema = z.strictObject({
  error: ErrorEnvelopeSchema.shape.error.strict(),
});

/**
 * Checks a response body is exactly the standard error envelope, and returns it without the
 * per-request ID so two responses can be compared.
 *
 * @param body - Parsed response body.
 * @returns The error code and message.
 * @throws {z.ZodError} When the body is not exactly `{ error: { code, message, requestId } }`.
 */
export function readError(body: unknown): { code: ErrorCode; message: string } {
  const { code, message } = StrictErrorEnvelopeSchema.parse(body).error;
  return { code, message };
}
