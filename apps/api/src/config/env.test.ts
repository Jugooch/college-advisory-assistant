/**
 * @file Tests for API environment validation, including the production dev-auth refusal.
 * @requirement FR-01
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  AuthMode,
  DEFAULT_AUDIT_RECORD_MAX_SKEW_MS,
  DEV_ACADEMIC_SOURCE_MAX_AGE_MS,
  loadApiEnv,
  MAX_ACADEMIC_SOURCE_MAX_AGE_MS,
  MAX_AUDIT_RECORD_MAX_SKEW_MS,
} from './env';

const BASE = { DATABASE_URL: 'postgres://unused.invalid/test' };
/** The settings production requires besides the database. */
const PRODUCTION = {
  NODE_ENV: 'production',
  ACTIVE_RULESET_VERSION: 'r-1',
  ACADEMIC_SOURCE_MAX_AGE_MS: '86400000',
};

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

  it('allows production when dev auth is off and a ruleset is active', () => {
    const env = loadApiEnv({ ...BASE, ...PRODUCTION });

    expect(env.AUTH_MODE).toBe(AuthMode.None);
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

describe('loadApiEnv AUDIT_RECORD_MAX_SKEW_MS', () => {
  it('defaults to one hour, well under the 17-day seeded stale gap', () => {
    const env = loadApiEnv(BASE);

    expect(env.AUDIT_RECORD_MAX_SKEW_MS).toBe(3_600_000);
    expect(DEFAULT_AUDIT_RECORD_MAX_SKEW_MS).toBeLessThan(17 * 24 * 60 * 60 * 1000);
  });

  it('parses a configured whole number of milliseconds, including 0', () => {
    expect(
      loadApiEnv({ ...BASE, AUDIT_RECORD_MAX_SKEW_MS: '900000' }).AUDIT_RECORD_MAX_SKEW_MS,
    ).toBe(900_000);
    expect(loadApiEnv({ ...BASE, AUDIT_RECORD_MAX_SKEW_MS: '0' }).AUDIT_RECORD_MAX_SKEW_MS).toBe(0);
  });

  it('accepts exactly seven days and refuses one millisecond more', () => {
    const at = (value: number) => (): unknown =>
      loadApiEnv({ ...BASE, AUDIT_RECORD_MAX_SKEW_MS: String(value) });

    expect(at(MAX_AUDIT_RECORD_MAX_SKEW_MS)()).toMatchObject({
      AUDIT_RECORD_MAX_SKEW_MS: 604_800_000,
    });
    expect(at(MAX_AUDIT_RECORD_MAX_SKEW_MS + 1)).toThrow(ZodError);
  });

  it.each(['', ' ', '-1', '1.5', '1e3', 'one-hour', 'Infinity'])(
    'refuses %j instead of coercing it',
    (value) => {
      expect(() => loadApiEnv({ ...BASE, AUDIT_RECORD_MAX_SKEW_MS: value })).toThrow(ZodError);
    },
  );
});

describe('loadApiEnv ACTIVE_RULESET_VERSION', () => {
  it('reads the configured version, and has no default outside production', () => {
    expect(loadApiEnv({ ...BASE, ACTIVE_RULESET_VERSION: 'demo-2026.1' })).toMatchObject({
      ACTIVE_RULESET_VERSION: 'demo-2026.1',
    });
    expect(loadApiEnv(BASE).ACTIVE_RULESET_VERSION).toBeUndefined();
  });

  it.each([undefined, '', '  '])('refuses to start in production with %j', (value) => {
    const source = { ...BASE, ...PRODUCTION, ACTIVE_RULESET_VERSION: value };

    expect(() => loadApiEnv(source)).toThrow(ZodError);
  });
});

describe('loadApiEnv ACADEMIC_SOURCE_MAX_AGE_MS', () => {
  it('defaults to 24 hours outside production', () => {
    expect(loadApiEnv(BASE).ACADEMIC_SOURCE_MAX_AGE_MS).toBe(86_400_000);
    expect(DEV_ACADEMIC_SOURCE_MAX_AGE_MS).toBe(86_400_000);
  });

  it('reads a configured value, up to seven days', () => {
    const at = (value: string) =>
      loadApiEnv({ ...BASE, ACADEMIC_SOURCE_MAX_AGE_MS: value }).ACADEMIC_SOURCE_MAX_AGE_MS;

    expect([at('3600000'), at(String(MAX_ACADEMIC_SOURCE_MAX_AGE_MS))]).toEqual([
      3_600_000, 604_800_000,
    ]);
  });

  it('refuses to start in production without it', () => {
    const source = { ...BASE, ...PRODUCTION, ACADEMIC_SOURCE_MAX_AGE_MS: undefined };

    expect(() => loadApiEnv(source)).toThrow(/ACADEMIC_SOURCE_MAX_AGE_MS is required/);
  });

  it.each(['', '-1', '1.5', 'one-day', String(MAX_ACADEMIC_SOURCE_MAX_AGE_MS + 1)])(
    'refuses %j instead of coercing it',
    (value) => {
      expect(() => loadApiEnv({ ...BASE, ACADEMIC_SOURCE_MAX_AGE_MS: value })).toThrow(ZodError);
    },
  );
});

describe('loadApiEnv SCHEDULE_SOLVER_WORK_CAP', () => {
  it('defaults to 3,000,000 units in every environment', () => {
    expect(loadApiEnv(BASE).SCHEDULE_SOLVER_WORK_CAP).toBe(3_000_000);
    expect(loadApiEnv({ ...BASE, ...PRODUCTION }).SCHEDULE_SOLVER_WORK_CAP).toBe(3_000_000);
  });

  it('accepts 1 and exactly 3,000,000, and refuses one unit more', () => {
    const at = (value: string) => (): unknown =>
      loadApiEnv({ ...BASE, SCHEDULE_SOLVER_WORK_CAP: value });

    expect(at('1')()).toMatchObject({ SCHEDULE_SOLVER_WORK_CAP: 1 });
    expect(at('3000000')()).toMatchObject({ SCHEDULE_SOLVER_WORK_CAP: 3_000_000 });
    expect(at('3000001')).toThrow(ZodError);
  });

  it.each(['', ' ', '0', '-1', '1.5', '1e3', 'many'])('refuses %j at startup', (value) => {
    expect(() => loadApiEnv({ ...BASE, SCHEDULE_SOLVER_WORK_CAP: value })).toThrow(ZodError);
  });
});
