/**
 * @file Tests that the `@caa/api/testing` entry point exposes what tests need to assemble the app.
 */
import { describe, expect, it } from 'vitest';

import * as testing from './testing';

describe('@caa/api/testing', () => {
  it('exports the app and container factories', () => {
    expect(typeof testing.buildApp).toBe('function');
    expect(typeof testing.createContainer).toBe('function');
  });

  it('exports an env loader that validates the given source', () => {
    const env = testing.loadApiEnv({ DATABASE_URL: 'postgres://unused', AUTH_MODE: 'dev' });

    expect(env.AUTH_MODE).toBe(testing.AuthMode.Dev);
  });
});
