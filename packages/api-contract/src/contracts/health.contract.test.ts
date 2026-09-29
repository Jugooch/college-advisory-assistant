/**
 * @file Tests for the health contract.
 */
import { describe, expect, it } from 'vitest';

import { getHealthEndpoint, HealthResponseSchema } from './health.contract';

const VALID = { status: 'ok', version: '0.1.0', checkedAt: '2026-09-29T09:00:00Z' };

describe('getHealthEndpoint', () => {
  it('declares GET /v1/health', () => {
    expect(getHealthEndpoint).toMatchObject({ method: 'GET', path: '/v1/health' });
  });
});

describe('HealthResponseSchema', () => {
  it.each(['none', 'dev'])('accepts auth mode %s', (authMode) => {
    expect(HealthResponseSchema.parse({ ...VALID, authMode })).toEqual({ ...VALID, authMode });
  });

  it('rejects a response without an auth mode', () => {
    expect(HealthResponseSchema.safeParse(VALID).success).toBe(false);
  });

  it.each(['oidc', 'DEV', '', null])('rejects the unsupported auth mode %s', (authMode) => {
    expect(HealthResponseSchema.safeParse({ ...VALID, authMode }).success).toBe(false);
  });
});
