/**
 * @file Tests for the dev sign-in action's wiring: the production refusal, the cookie it writes,
 * and where it redirects.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevSignInDisabledError } from '../utils/dev-sign-in';
import { devSignInAction } from './dev-sign-in.action';

const cookieStore = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn(), get: vi.fn() }));
const redirectTo = vi.hoisted(() =>
  vi.fn((path: string): never => {
    throw new Error(`redirect:${path}`);
  }),
);

vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
vi.mock('next/navigation', () => ({ redirect: redirectTo }));

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

describe('devSignInAction', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('writes an httpOnly session cookie and goes home', async () => {
    await expect(devSignInAction(tokenForm('dev-token-student'))).rejects.toThrow('redirect:/');

    expect(cookieStore.set).toHaveBeenCalledWith('caa_session', 'dev-token-student', {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: 28800,
    });
  });

  it('refuses in a production build and writes no cookie', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    await expect(devSignInAction(tokenForm('dev-token-student'))).rejects.toThrow(
      DevSignInDisabledError,
    );

    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('returns to the form with an error for a malformed token and writes no cookie', async () => {
    await expect(devSignInAction(tokenForm('dev token'))).rejects.toThrow(
      'redirect:/dev/sign-in?error=invalid-token',
    );

    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
