/**
 * @file Tests that the `@caa/db` root exposes the local-database reset guard for root tooling.
 */
import { describe, expect, it } from 'vitest';

import * as root from './index';

describe('@caa/db root', () => {
  it('exports the reset guard and its refusal error', () => {
    expect(typeof root.assertResetAllowed).toBe('function');
    expect(typeof root.ResetRefusedError).toBe('function');
  });

  it('allows a local database and refuses production without connecting', () => {
    const url = 'postgres://u:p@localhost:5432/caa';

    expect(root.assertResetAllowed({ NODE_ENV: 'development', DATABASE_URL: url })).toBe(url);
    expect(() => root.assertResetAllowed({ NODE_ENV: 'production', DATABASE_URL: url })).toThrow(
      root.ResetRefusedError,
    );
  });
});
