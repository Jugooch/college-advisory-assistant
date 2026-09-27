/**
 * @file Converts every thrown error into the standard error envelope.
 * @module @caa/api/plugins/error-handler
 * @requirement FR-14
 * @see docs/standards/05-api-design.md
 */
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { ErrorCode } from '@caa/domain';

import { DomainError } from '../shared/domain-errors';

/** HTTP status for each typed error code (standards/05 status table). */
const STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  [ErrorCode.InvalidRequest]: 400,
  [ErrorCode.Unauthorized]: 401,
  [ErrorCode.NotFound]: 404,
  [ErrorCode.OutOfScope]: 422,
  [ErrorCode.SourceUnavailable]: 503,
  [ErrorCode.StaleSource]: 409,
  [ErrorCode.SemanticGap]: 422,
  [ErrorCode.RevisionConflict]: 409,
  [ErrorCode.SearchTimeout]: 422,
  [ErrorCode.NoFeasiblePlan]: 422,
  [ErrorCode.InternalError]: 500,
};

/**
 * Checks whether a thrown value carries a numeric HTTP status.
 *
 * @param error - Anything that was thrown.
 * @returns True when `error.statusCode` is a number.
 */
function isErrorWithStatusCode(error: unknown): error is { statusCode: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  );
}

/**
 * Builds a log-safe description of an error, without submitted values.
 *
 * @param error - Anything that was thrown.
 * @returns Error name, and for validation errors only the failing paths and issue codes.
 */
function describeError(error: unknown): Record<string, unknown> {
  // SECURITY: validation errors can carry submitted values; log only paths and issue codes.
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code }));
    return { errorName: 'ZodError', issues };
  }
  if (error instanceof Error) {
    return { errorName: error.name, stack: error.stack };
  }
  return { errorName: typeof error };
}

/**
 * Registers the global error and not-found handlers.
 *
 * @param app - Root Fastify instance.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      // NOTE: typed errors are expected outcomes (401, 404, ...), so they log at info, not error.
      request.log.info({ errorName: error.name, code: error.code }, 'request rejected');
      const envelope = { code: error.code, message: error.message, requestId: request.id };
      return reply.status(STATUS_BY_CODE[error.code]).send({ error: envelope });
    }
    // SECURITY: never echo internals or student data to the client.
    request.log.error(describeError(error), 'request failed');
    const status = isErrorWithStatusCode(error) ? error.statusCode : 500;
    const isClientError = status < 500;
    const code = isClientError ? ErrorCode.InvalidRequest : ErrorCode.InternalError;
    const message = isClientError ? 'The request was invalid' : 'An unexpected error occurred';
    return reply.status(status).send({ error: { code, message, requestId: request.id } });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: { code: ErrorCode.NotFound, message: 'Route not found', requestId: request.id },
    }),
  );
}
