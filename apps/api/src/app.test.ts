/**
 * @file HTTP-level tests for the assembled app.
 */
import { ErrorCode } from '@caa/domain';
import { describe, expect, it } from 'vitest';

import { buildApp } from './app';
import { createControllers } from './container';

const app = buildApp({
  controllers: createControllers({ API_PORT: 0, API_HOST: '127.0.0.1', APP_VERSION: 'test' }),
  isLoggerEnabled: false,
});

describe('GET /v1/health', () => {
  it('returns the health payload inside the data envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ data: { status: 'ok', version: 'test' } });
  });
});

describe('unknown routes', () => {
  it('return the standard NOT_FOUND envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/does-not-exist' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: ErrorCode.NotFound } });
  });
});
