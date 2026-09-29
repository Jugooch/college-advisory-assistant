/**
 * @file Tests which PR bodies count as authorizing an `ownership-override` (standard 08).
 * @see docs/standards/08-git-and-pull-requests.md
 */
import { describe, expect, it } from 'vitest';

import { hasOverrideAuthorization } from './override-authorization.mjs';

const RIPPLE =
  '> **Ownership override (required-field ripple, standard 08, authorized by #108):** the ' +
  'orchestrator changed only `packages/test-kit/src/builders/term.builder.ts`.';

describe('hasOverrideAuthorization', () => {
  it.each([
    ['the standard 08 ripple wording', RIPPLE],
    ['an issue number', 'Rename across packages, authorized by #212.'],
    ['an ADR id', 'Authorized by ADR-0009.'],
    ['a linked ADR', 'Authorized by [ADR-0009](docs/adr/0009-rename-packages.md).'],
    ['an ADR path', 'authorized by docs/adr/0009-rename-packages.md'],
    ['a linked issue', 'authorized by [#212](https://github.com/o/r/issues/212)'],
    ['an issue URL', 'authorized by https://github.com/o/r/issues/212'],
    ['British spelling', 'authorised by #212'],
    ['a line break after "by"', 'authorized by\n#212'],
  ])('accepts %s', (_name, body) => {
    expect(hasOverrideAuthorization(body)).toBe(true);
  });

  it.each([
    ['no body', undefined],
    ['an empty body', ''],
    ['no authorization', '## Summary\nTouches another owner area.'],
    ['a bare issue reference', 'closes #212'],
    ['a bare ADR mention', 'Follows ADR-0004.'],
    ['a placeholder', 'authorized by #N'],
    ['"authorized by" without a reference', 'authorized by the tech lead'],
    ['a pull request URL', 'authorized by https://github.com/o/r/pull/212'],
    ['a non-ADR docs link', 'authorized by docs/standards/08-git-and-pull-requests.md'],
    ['text only inside an HTML comment', '<!-- authorized by #108 -->\n## Summary'],
  ])('rejects %s', (_name, body) => {
    expect(hasOverrideAuthorization(body)).toBe(false);
  });
});
