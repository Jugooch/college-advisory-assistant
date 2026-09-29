/**
 * @file Development sign-in page. Not found in production builds, whose action also refuses, or
 * when the API doesn't report the `dev` auth mode.
 * @module @caa/web/app/dev/sign-in/page
 * @requirement FR-01
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { getHealth } from '@/api/health.api';
import { devSignInAction } from '@/features/session/actions/dev-sign-in.action';
import { devSignOutAction } from '@/features/session/actions/dev-sign-out.action';
import { DevSignInForm } from '@/features/session/components/dev-sign-in-form';
import { isDevSignInOffered } from '@/features/session/utils/dev-sign-in';

/** Page title. */
export const metadata: Metadata = { title: 'Development sign-in' };

/** Never prerender: the page depends on the build and the request. */
export const dynamic = 'force-dynamic';

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
  const health = await getHealth().catch(() => null);
  if (!isDevSignInOffered(process.env.NODE_ENV, health?.authMode)) {
    notFound();
  }
  const { error } = await searchParams;
  return (
    <DevSignInForm
      signInAction={devSignInAction}
      signOutAction={devSignOutAction}
      hasInvalidToken={error === 'invalid-token'}
    />
  );
}
