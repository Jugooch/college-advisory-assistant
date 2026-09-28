/**
 * @file Tests for development sign-in: the cookie it writes and its refusal in production.
 */
import { describe, expect, it } from 'vitest';

import {
  DevSignInDisabledError,
  isDevSignInEnabled,
  signInWithDevToken,
  signOut,
} from './dev-sign-in';
import type { SessionCookieOptions, SessionCookieStore } from './session-cookie';

/** One cookie write the fake store received. */
interface CookieWrite {
  readonly name: string;
  readonly value: string;
  readonly options: SessionCookieOptions;
}

/**
 * Builds a cookie store that records writes and deletions.
 *
 * @returns The store and what it received.
 */
function recordingStore(): {
  store: SessionCookieStore;
  writes: CookieWrite[];
  deletions: string[];
} {
  const writes: CookieWrite[] = [];
  const deletions: string[] = [];
  const store: SessionCookieStore = {
    get: () => undefined,
    set: (name, value, options) => writes.push({ name, value, options }),
    delete: (name) => deletions.push(name),
  };
  return { store, writes, deletions };
}

/**
 * Builds a submitted form with one token field.
 *
 * @param token - The field value.
 * @returns The form data.
 */
function tokenForm(token: string): FormData {
  const form = new FormData();
  form.set('token', token);
  return form;
}

describe('isDevSignInEnabled', () => {
  it('is enabled in development and test builds', () => {
    expect(isDevSignInEnabled('development')).toBe(true);
    expect(isDevSignInEnabled('test')).toBe(true);
  });

  it('is disabled in production builds', () => {
    expect(isDevSignInEnabled('production')).toBe(false);
  });
});

describe('signInWithDevToken', () => {
  it('stores the token in an httpOnly, strict same-site session cookie', () => {
    const { store, writes } = recordingStore();

    const result = signInWithDevToken(tokenForm('dev-token-student'), {
      nodeEnv: 'development',
      cookieStore: store,
    });

    expect(result).toBe('SIGNED_IN');
    expect(writes).toEqual([
      {
        name: 'caa_session',
        value: 'dev-token-student',
        options: { httpOnly: true, sameSite: 'strict', secure: false, path: '/', maxAge: 28800 },
      },
    ]);
  });

  it('refuses in a production build and writes no cookie', () => {
    const { store, writes } = recordingStore();

    const signIn = (): unknown =>
      signInWithDevToken(tokenForm('dev-token-student'), {
        nodeEnv: 'production',
        cookieStore: store,
      });

    expect(signIn).toThrow(DevSignInDisabledError);
    expect(writes).toEqual([]);
  });

  it('rejects a token with spaces and writes no cookie', () => {
    const { store, writes } = recordingStore();

    const result = signInWithDevToken(tokenForm('dev token'), {
      nodeEnv: 'development',
      cookieStore: store,
    });

    expect(result).toBe('INVALID_TOKEN');
    expect(writes).toEqual([]);
  });

  it('rejects a form without a token field', () => {
    const { store, writes } = recordingStore();

    const result = signInWithDevToken(new FormData(), { nodeEnv: 'test', cookieStore: store });

    expect(result).toBe('INVALID_TOKEN');
    expect(writes).toEqual([]);
  });
});

describe('signOut', () => {
  it('deletes the session cookie', () => {
    const { store, deletions } = recordingStore();

    signOut(store);

    expect(deletions).toEqual(['caa_session']);
  });
});
