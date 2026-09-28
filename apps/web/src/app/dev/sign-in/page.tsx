/**
 * @file Development sign-in page. Not found in production builds, whose action also refuses.
 * @module @caa/web/app/dev/sign-in/page
 * @requirement FR-01
 */
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { DevSignInForm } from '@/features/session/components/dev-sign-in-form';
import { isDevSignInEnabled, signInWithDevToken, signOut } from '@/lib/dev-sign-in';

/** Never prerender: the page depends on the build and the request. */
export const dynamic = 'force-dynamic';

/**
 * Stores the submitted dev token in the session cookie, then goes home to show the result.
 *
 * @param formData - The submitted form.
 */
async function signInAction(formData: FormData): Promise<void> {
  'use server';
  // SECURITY: signInWithDevToken throws in a production build, so the action refuses even if
  // it is called directly.
  const result = signInWithDevToken(formData, {
    nodeEnv: process.env.NODE_ENV,
    cookieStore: await cookies(),
  });
  redirect(result === 'SIGNED_IN' ? '/' : '/dev/sign-in?error=invalid-token');
}

/** Removes the session cookie and returns to the sign-in page. */
async function signOutAction(): Promise<void> {
  'use server';
  signOut(await cookies());
  redirect('/dev/sign-in');
}

/**
 * Renders the development sign-in page.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function DevSignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  if (!isDevSignInEnabled(process.env.NODE_ENV)) {
    notFound();
  }
  const { error } = await searchParams;
  return (
    <DevSignInForm
      signInAction={signInAction}
      signOutAction={signOutAction}
      hasInvalidToken={error === 'invalid-token'}
    />
  );
}
