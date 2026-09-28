/**
 * @file Tests for the text-labelled status badge.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the label as text so the tone is never the only signal', () => {
    const html = renderToStaticMarkup(<StatusBadge label="Needs verification" tone="caution" />);

    expect(html).toBe('<span class="status-badge status-badge--caution">Needs verification</span>');
  });
});
