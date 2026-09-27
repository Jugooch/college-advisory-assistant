/**
 * @file Tests for loading the worker environment.
 */
import { describe, expect, it } from 'vitest';

import { loadWorkerEnv } from './worker-env';

const DATABASE_URL = 'postgres://caa:caa@localhost:5432/caa';

describe('loadWorkerEnv', () => {
  it('defaults the roster invalid-row threshold to 5 percent', () => {
    expect(loadWorkerEnv({ DATABASE_URL })).toEqual({
      DATABASE_URL,
      ROSTER_MAX_INVALID_ROW_PERCENT: 5,
    });
  });

  it('reads the threshold as a whole percent', () => {
    const env = loadWorkerEnv({ DATABASE_URL, ROSTER_MAX_INVALID_ROW_PERCENT: '10' });

    expect(env.ROSTER_MAX_INVALID_ROW_PERCENT).toBe(10);
  });

  it.each(['101', '-1', '2.5'])('rejects the threshold %s', (value) => {
    expect(() => loadWorkerEnv({ DATABASE_URL, ROSTER_MAX_INVALID_ROW_PERCENT: value })).toThrow();
  });

  it('fails fast without a database URL', () => {
    expect(() => loadWorkerEnv({})).toThrow();
  });
});
