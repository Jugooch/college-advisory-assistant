/**
 * @file Home page. Fetches data through `src/api` and composes feature components.
 * @module @caa/web/app/page
 */
import type { ReactElement } from 'react';

import { getHealth } from '@/api/health.api';
import { SystemStatusCard } from '@/features/system-status/components/system-status-card';

/** Render on every request so the status is always current. */
export const dynamic = 'force-dynamic';

/**
 * Renders the home page.
 *
 * @returns The page element.
 */
export default async function HomePage(): Promise<ReactElement> {
  const health = await getHealth().catch(() => null);
  return (
    <main>
      <h1>College Advisory Assistant</h1>
      <SystemStatusCard health={health} />
    </main>
  );
}
