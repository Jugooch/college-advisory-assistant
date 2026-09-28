/**
 * @file Tests for the `'use server'` placement rule (ADR-0007).
 */
import { describe, expect, it } from 'vitest';

import { checkServerDirective } from './server-directive-rules.mjs';

const ACTION = 'apps/web/src/features/session/actions/dev-sign-in.action.ts';
const HEADER = '/**\n * @file Signs in with a dev token.\n */\n';

describe('checkServerDirective', () => {
  it('accepts an action file whose first statement follows the @file header', () => {
    const source = `${HEADER}'use server';\n\nimport { redirect } from 'next/navigation';\n`;

    expect(checkServerDirective(ACTION, source)).toBeNull();
  });

  it('accepts double quotes and line comments before the directive', () => {
    const source = `// NOTE: synthetic tokens only.\n"use server"\nexport async function a() {}\n`;

    expect(checkServerDirective(ACTION, source)).toBeNull();
  });

  it('rejects an action file without the directive', () => {
    const source = `${HEADER}import { redirect } from 'next/navigation';\n`;

    expect(checkServerDirective(ACTION, source)).toBe(
      "server action files start with 'use server'",
    );
  });

  it('rejects an action file where the directive is not the first statement', () => {
    const source = `${HEADER}import { redirect } from 'next/navigation';\n'use server';\n`;

    expect(checkServerDirective(ACTION, source)).toContain("start with 'use server'");
  });

  it('rejects a function-level directive in a page', () => {
    const source = `export default function Page() {\n  async function go() {\n    'use server';\n  }\n}\n`;

    expect(checkServerDirective('apps/web/src/app/dev/sign-in/page.tsx', source)).toBe(
      'server actions live in features/<feature>/actions/*.action.ts',
    );
  });

  it('rejects a file-level directive in a component', () => {
    const path = 'apps/web/src/shared/components/api-error-notice.tsx';

    expect(checkServerDirective(path, `${HEADER}'use server';\n`)).toContain('*.action.ts');
  });

  it('exempts action tests and non-web files', () => {
    const source = "'use server';\n";

    expect(checkServerDirective(ACTION.replace('.ts', '.test.ts'), source)).toBeNull();
    expect(checkServerDirective('apps/api/src/app.ts', source)).toBeNull();
  });

  it('ignores the words inside ordinary code', () => {
    const source = `const note = "use server actions for forms";\n`;

    expect(checkServerDirective('apps/web/src/shared/utils/x.ts', source)).toBeNull();
  });
});
