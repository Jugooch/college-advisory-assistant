/**
 * @file Tests that the error handler maps typed errors and keeps the 400/500 fallbacks.
 */
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ErrorCode } from '@caa/domain';

import { DomainError, NotFoundError, UnauthorizedError } from '../shared/domain-errors';
import { readError } from '../testing/fixtures';
import { registerErrorHandler } from './error-handler.plugin';

const app = Fastify({ logger: false });
registerErrorHandler(app);
const failures: Readonly<Record<string, () => never>> = {
  notFound: () => {
    throw new NotFoundError();
  },
  unauthorized: () => {
    throw new UnauthorizedError();
  },
  conflict: () => {
    throw new DomainError(ErrorCode.RevisionConflict, 'This plan changed. Reload it.');
  },
  badStatus: () => {
    throw Object.assign(new Error('client mistake with internals'), { statusCode: 400 });
  },
  zod: () => {
    z.string().parse(42);
    throw new Error('unreachable');
  },
  crash: () => {
    throw new Error('database password leaked in stack');
  },
};
for (const [name, fail] of Object.entries(failures)) {
  app.get(`/fail/${name}`, fail);
}

describe('registerErrorHandler', () => {
  it.each([
    {
      name: 'notFound',
      status: 404,
      code: ErrorCode.NotFound,
      message: 'The requested resource was not found',
    },
    {
      name: 'unauthorized',
      status: 401,
      code: ErrorCode.Unauthorized,
      message: 'Sign in to continue',
    },
    {
      name: 'conflict',
      status: 409,
      code: ErrorCode.RevisionConflict,
      message: 'This plan changed. Reload it.',
    },
    {
      name: 'badStatus',
      status: 400,
      code: ErrorCode.InvalidRequest,
      message: 'The request was invalid',
    },
    {
      name: 'zod',
      status: 500,
      code: ErrorCode.InternalError,
      message: 'An unexpected error occurred',
    },
    {
      name: 'crash',
      status: 500,
      code: ErrorCode.InternalError,
      message: 'An unexpected error occurred',
    },
  ])('maps $name to $status $code with a safe message', async ({ name, status, code, message }) => {
    const response = await app.inject({ method: 'GET', url: `/fail/${name}` });

    expect(response.statusCode).toBe(status);
    expect(readError(response.json())).toEqual({ code, message });
  });
});
