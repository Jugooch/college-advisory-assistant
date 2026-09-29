/**
 * @file HTTP-level tests for the assembled app: public routes and unknown routes.
 */
import { describe, expect, it } from 'vitest';

import { AuthMode, ErrorCode } from '@caa/domain';

import { buildWorldApp } from './testing/fixtures';

const { app } = buildWorldApp();

describe('GET /v1/health', () => {
  it('returns the health payload and the auth mode inside the data envelope without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        status: 'ok',
        version: 'test',
        checkedAt: '2026-09-01T12:00:00.000Z',
        authMode: AuthMode.Dev,
      },
    });
  });
});

describe('unknown routes', () => {
  it('return the standard NOT_FOUND envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/does-not-exist' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: ErrorCode.NotFound } });
  });
});
