/**
 * @file Tests for the dev sign-out action's wiring.
 */
import { describe, expect, it, vi } from 'vitest';

import { devSignOutAction } from './dev-sign-out.action';

const cookieStore = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn(), get: vi.fn() }));
const redirectTo = vi.hoisted(() =>
  vi.fn((path: string): never => {
    throw new Error(`redirect:${path}`);
  }),
);

vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
vi.mock('next/navigation', () => ({ redirect: redirectTo }));

describe('devSignOutAction', () => {
  it('deletes the session cookie and returns to the sign-in page', async () => {
    await expect(devSignOutAction()).rejects.toThrow('redirect:/dev/sign-in');

    expect(cookieStore.delete).toHaveBeenCalledWith('caa_session');
  });
});
