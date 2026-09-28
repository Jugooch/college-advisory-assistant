/**
 * @file Tests for the dev sign-in gate and token parsing.
 */
import { describe, expect, it } from 'vitest';

import { isDevSignInEnabled, parseDevToken } from './dev-sign-in';

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

describe('parseDevToken', () => {
  it('returns a one-word token, trimmed', () => {
    expect(parseDevToken(tokenForm('  dev-token-student '))).toBe('dev-token-student');
  });

  it('rejects a token with spaces', () => {
    expect(parseDevToken(tokenForm('dev token'))).toBeNull();
  });

  it('rejects an empty token', () => {
    expect(parseDevToken(tokenForm(''))).toBeNull();
  });

  it('rejects a form without a token field', () => {
    expect(parseDevToken(new FormData())).toBeNull();
  });
});
