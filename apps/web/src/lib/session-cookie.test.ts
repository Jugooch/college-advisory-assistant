/**
 * @file Tests for the session cookie attributes, and reading, writing, and clearing the token.
 */
import { describe, expect, it } from 'vitest';

import {
  clearSessionToken,
  readSessionToken,
  type SessionCookieOptions,
  sessionCookieOptions,
  writeSessionToken,
} from './session-cookie';

describe('sessionCookieOptions', () => {
  it('keeps the cookie httpOnly and strict same-site, not secure outside production', () => {
    expect(sessionCookieOptions('development')).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: 28800,
    });
  });

  it('marks the cookie secure in production', () => {
    expect(sessionCookieOptions('production')).toMatchObject({ httpOnly: true, secure: true });
  });
});

describe('readSessionToken', () => {
  it('returns the session cookie value', () => {
    const store = {
      get: (name: string) => (name === 'caa_session' ? { value: 'abc' } : undefined),
    };

    expect(readSessionToken(store)).toBe('abc');
  });

  it('returns null for a missing or empty cookie', () => {
    expect(readSessionToken({ get: () => undefined })).toBeNull();
    expect(readSessionToken({ get: () => ({ value: '' }) })).toBeNull();
  });
});

describe('writeSessionToken', () => {
  it('writes the token under the session name with the session attributes', () => {
    const writes: [string, string, SessionCookieOptions][] = [];

    writeSessionToken(
      { set: (name, value, options) => writes.push([name, value, options]) },
      'dev-token-student',
      'test',
    );

    expect(writes).toEqual([['caa_session', 'dev-token-student', sessionCookieOptions('test')]]);
  });
});

describe('clearSessionToken', () => {
  it('deletes the session cookie', () => {
    const deletions: string[] = [];

    clearSessionToken({ delete: (name) => deletions.push(name) });

    expect(deletions).toEqual(['caa_session']);
  });
});
