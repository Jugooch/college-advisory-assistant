/**
 * @file Root layout shared by every page.
 * @module @caa/web/app/layout
 */
import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';

import './globals.css';

/** Default document metadata. */
export const metadata: Metadata = {
  title: 'College Advisory Assistant',
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
      <body>{children}</body>
    </html>
  );
}
