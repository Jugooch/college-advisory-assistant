/**
 * @file Root layout shared by every page: skip link, site header, and the main landmark.
 * @module @caa/web/app/layout
 * @requirement NFR-02
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import './globals.css';

/** Default document metadata. */
export const metadata: Metadata = {
  title: { default: 'College Advisory Assistant', template: '%s · College Advisory Assistant' },
  description: 'Verified next-term course planning.',
};

/**
 * Wraps every page in the document shell.
 *
 * @param props - Page content.
 * @returns The HTML document.
 */
export default function RootLayout({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <header className="site-header">
          <Link href="/">College Advisory Assistant</Link>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
