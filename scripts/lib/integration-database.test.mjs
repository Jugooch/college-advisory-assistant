/**
 * @file Tests for the integration-test mode and per-run database naming.
 */
import { describe, expect, it } from 'vitest';

import {
  buildTestDatabaseName,
  quoteTestDatabaseName,
  resolveIntegrationMode,
  withDatabaseName,
} from './integration-database.mjs';

const SERVER_URL = 'postgres://caa:caa@localhost:5432/caa';

describe('resolveIntegrationMode', () => {
  it('runs when DATABASE_URL is set', () => {
    const resolved = resolveIntegrationMode({ DATABASE_URL: SERVER_URL, CI: 'true' });

    expect(resolved).toEqual({ mode: 'run', databaseUrl: SERVER_URL });
  });

  it('skips locally when DATABASE_URL is unset', () => {
    const resolved = resolveIntegrationMode({});

    expect(resolved.mode).toBe('skip');
    expect(resolved).toHaveProperty('reason', expect.stringContaining('DATABASE_URL is not set'));
  });

  it('fails in CI when DATABASE_URL is unset', () => {
    const resolved = resolveIntegrationMode({ CI: 'true' });

    expect(resolved.mode).toBe('fail');
  });

  it('treats a blank DATABASE_URL in CI as unset', () => {
    const resolved = resolveIntegrationMode({ CI: '1', DATABASE_URL: '  ' });

    expect(resolved.mode).toBe('fail');
  });

  it('skips when CI is set to something other than true', () => {
    const resolved = resolveIntegrationMode({ CI: 'false' });

    expect(resolved.mode).toBe('skip');
  });
});

describe('buildTestDatabaseName', () => {
  it('combines the run timestamp and process ID', () => {
    expect(buildTestDatabaseName(1700000000000, 42)).toBe('caa_test_1700000000000_42');
  });
});

describe('withDatabaseName', () => {
  it('replaces only the database of the URL', () => {
    const url = withDatabaseName(`${SERVER_URL}?sslmode=disable`, 'caa_test_1_2');

    expect(url).toBe('postgres://caa:caa@localhost:5432/caa_test_1_2?sslmode=disable');
  });
});

describe('quoteTestDatabaseName', () => {
  it('quotes a generated name', () => {
    expect(quoteTestDatabaseName('caa_test_1_2')).toBe('"caa_test_1_2"');
  });

  it('rejects a name that is not a generated test database', () => {
    expect(() => quoteTestDatabaseName('caa')).toThrow('unexpected test database name');
  });

  it('rejects a name carrying SQL', () => {
    expect(() => quoteTestDatabaseName('caa_test_1"; DROP DATABASE caa; --')).toThrow();
  });
});
