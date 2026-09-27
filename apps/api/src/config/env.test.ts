/**
 * @file Tests for API environment validation, including the production dev-auth refusal.
 * @requirement FR-01
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { AuthMode, loadApiEnv } from './env';

const BASE = { DATABASE_URL: 'postgres://unused.invalid/test' };

describe('loadApiEnv', () => {
  it('defaults to development with authentication mode none', () => {
    const env = loadApiEnv(BASE);

    expect(env).toMatchObject({ NODE_ENV: 'development', AUTH_MODE: AuthMode.None });
    expect(env.DEV_AUTH_TOKENS).toEqual({});
  });

  it('refuses to start when dev auth is enabled in production', () => {
    const load = (): unknown => loadApiEnv({ ...BASE, NODE_ENV: 'production', AUTH_MODE: 'dev' });

    expect(load).toThrow(ZodError);
    expect(load).toThrow(/AUTH_MODE=dev is not allowed when NODE_ENV=production/);
  });

  it('allows production when dev auth is off', () => {
    expect(loadApiEnv({ ...BASE, NODE_ENV: 'production' }).AUTH_MODE).toBe(AuthMode.None);
  });

  it('parses the dev token map when dev auth is on', () => {
    const tokens = { 'dev-token-1': { issuer: 'https://idp.synthetic.example', subject: 's-1' } };

    const env = loadApiEnv({ ...BASE, AUTH_MODE: 'dev', DEV_AUTH_TOKENS: JSON.stringify(tokens) });

    expect(env.DEV_AUTH_TOKENS).toEqual(tokens);
  });

  it('rejects a dev token map that is not JSON, without echoing the value', () => {
    const load = (): unknown => loadApiEnv({ ...BASE, DEV_AUTH_TOKENS: 'not-json-secret' });

    expect(load).toThrow(/must be valid JSON/);
    expect(load).not.toThrow(/not-json-secret/);
  });

  it('rejects a dev token entry without a subject', () => {
    const tokens = JSON.stringify({ 'dev-token-1': { issuer: 'https://idp.synthetic.example' } });

    expect(() => loadApiEnv({ ...BASE, DEV_AUTH_TOKENS: tokens })).toThrow(ZodError);
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadApiEnv({})).toThrow(ZodError);
  });

  it('rejects an unknown auth mode', () => {
    expect(() => loadApiEnv({ ...BASE, AUTH_MODE: 'sso' })).toThrow(ZodError);
  });
});
