/**
 * @file Converts every thrown error into the standard error envelope.
 * @module @caa/api/plugins/error-handler
 * @requirement FR-14
 */
import { ErrorCode } from '@caa/domain';
import type { FastifyInstance } from 'fastify';

/**
 * Reads an HTTP status from a thrown value, defaulting to 500.
 *
 * @param error - Anything that was thrown.
 * @returns The status code to send.
 */
function statusCodeOf(error: unknown): number {
  const hasStatus = typeof error === 'object' && error !== null && 'statusCode' in error;
  return hasStatus && typeof error.statusCode === 'number' ? error.statusCode : 500;
}

/**
 * Registers the global error and not-found handlers.
 *
 * @param app - Root Fastify instance.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    // SECURITY: log the full error server-side, but never echo internals or student data to the client.
    request.log.error({ err: error }, 'request failed');
    const status = statusCodeOf(error);
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
