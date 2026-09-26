/**
 * @file Converts every thrown error into the standard error envelope.
 * @module @caa/api/plugins/error-handler
 * @requirement FR-14
 */
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { ErrorCode } from '@caa/domain';

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
