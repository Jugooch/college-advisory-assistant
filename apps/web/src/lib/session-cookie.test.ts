/**
 * @file Tests for the session cookie attributes and token reading.
 */
import { describe, expect, it } from 'vitest';

import { readSessionToken, sessionCookieOptions } from './session-cookie';

describe('sessionCookieOptions', () => {
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
