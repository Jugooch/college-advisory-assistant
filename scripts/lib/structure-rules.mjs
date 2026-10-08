/**
 * @file File placement and role-suffix rules for each folder, used by the convention check.
 * @module scripts/lib/structure-rules
 * @see docs/standards/01-repository-structure.md
 * @see docs/standards/07-testing.md
 */
import { basename } from 'node:path';

/** Optional test suffix; database integration tests add `.integration` (standards/07). */
const TEST = String.raw`(\.(integration\.)?test)?`;

/**
 * Where each kind of file must live. The first rule whose `scope` matches a path applies.
 * `allow` receives the file name and the scope match, and returns true when the name is valid.
 */
const STRUCTURE_RULES = [
  {
    // SECURITY: the 'use server' placement check and the web lint rules read .ts/.tsx only.
    scope: /^apps\/web\/src\/.*\.(js|jsx|mjs|cjs)$/,
    allow: () => false,
    expected: 'TypeScript only under apps/web/src (.ts or .tsx)',
  },
  {
    scope: /^apps\/web\/src\/app\/.*route\.tsx?$/,
    allow: () => false,
    expected: 'no route handlers in Next.js; add the endpoint to apps/api',
  },
  {
    scope: /^apps\/api\/src\/modules\/([a-z0-9-]+)\/[^/]+$/,
    allow: (name, match) =>
      new RegExp(`^${match[1]}\\.(routes|controller|service|mapper|logic)${TEST}\\.ts$`).test(name),
    expected: '<module>.routes.ts | .controller.ts | .service.ts | .mapper.ts | .logic.ts',
  },
  {
    scope: /^apps\/api\/src\/wiring\/.*\/[^/]+$/,
    allow: () => false,
    expected: 'wiring files directly in apps/api/src/wiring/ (no subfolders)',
  },
  {
    scope: /^apps\/api\/src\/wiring\//,
    allow: (name) => /^[a-z0-9-]+\.wiring(\.test)?\.ts$/.test(name),
    expected: '<area>.wiring.ts (ADR-0014)',
  },
  {
    scope: /^apps\/api\/src\/plugins\//,
    allow: (name) => /\.plugin(\.(integration\.)?test)?\.ts$/.test(name),
    expected: '*.plugin.ts',
  },
  {
    scope: /^apps\/api\/src\/[^/]+$/,
    allow: (name) =>
      /^(server|app|container)(\.(integration\.)?test)?\.ts$/.test(name) ||
      /^testing(\.test)?\.ts$/.test(name),
    expected:
      'server.ts | app.ts | container.ts | testing.ts (other code goes in modules/, plugins/, shared/, config/)',
  },
  {
    scope: /^packages\/domain\/src\/models\//,
    allow: (name) => /\.model(\.test)?\.ts$/.test(name),
    expected: '*.model.ts',
  },
  {
    scope: /^packages\/domain\/src\/enums\//,
    allow: (name) => /\.enum(\.test)?\.ts$/.test(name),
    expected: '*.enum.ts',
  },
  {
    scope: /^packages\/api-contract\/src\/contracts\//,
    allow: (name) => /\.contract(\.test)?\.ts$/.test(name),
    expected: '*.contract.ts',
  },
  {
    scope: /^packages\/db\/src\/tables\//,
    allow: (name) => /\.table\.ts$/.test(name),
    expected: '*.table.ts',
  },
  {
    scope: /^packages\/db\/src\/mappers\//,
    allow: (name) => /\.mapper(\.(integration\.)?test)?\.ts$/.test(name),
    expected: '*.mapper.ts',
  },
  {
    scope: /^packages\/db\/src\/repositories\//,
    allow: (name) => /\.repository(\.(integration\.)?test)?\.ts$/.test(name),
    expected: '*.repository.ts',
  },
  {
    scope: /^apps\/worker\/src\/jobs\//,
    allow: (name) => /\.job(\.(integration\.)?test)?\.ts$/.test(name),
    expected: '*.job.ts',
  },
  {
    scope: /^apps\/worker\/src\/adapters\//,
    allow: (name) => /\.adapter(\.(integration\.)?test)?\.ts$/.test(name),
    expected: '*.adapter.ts',
  },
  {
    scope: /^apps\/web\/src\/app\//,
    allow: (name) =>
      /^(page|layout|loading|error|not-found|global-error|template|default)\.tsx$/.test(name) ||
      /^(globals\.css|[a-z0-9-]+\.module\.css|favicon\.ico|icon\.(png|svg))$/.test(name),
    expected:
      'Next.js reserved files only (page.tsx, layout.tsx, ...); put UI in features/ or components/',
  },
  {
    scope: /^apps\/web\/src\/api\//,
    allow: (name) => /\.api(\.test)?\.ts$/.test(name),
    expected: '*.api.ts',
  },
  {
    scope: /^apps\/web\/src\/features\/[a-z0-9-]+\/actions\//,
    allow: (name) => /^[a-z0-9-]+\.action(\.test)?\.ts$/.test(name),
    expected: '*.action.ts',
  },
  {
    scope: /^apps\/web\/src\/features\/[a-z0-9-]+\/utils\//,
    allow: (name) => /^[a-z0-9-]+(\.test)?\.ts$/.test(name),
    expected: '*.ts (utils have no JSX)',
  },
  {
    scope: /^apps\/web\/src\/features\/[a-z0-9-]+\/hooks\//,
    allow: (name) => /^use-[a-z0-9-]+(\.test)?\.tsx?$/.test(name),
    expected: 'use-*.ts',
  },
  {
    scope: /^apps\/web\/src\/features\/[a-z0-9-]+\/components\//,
    allow: (name) => /(\.test)?\.tsx$/.test(name),
    expected: '*.tsx',
  },
  {
    scope: /^apps\/web\/src\/features\/[a-z0-9-]+\/(?!(actions|components|hooks|utils)\/)/,
    allow: () => false,
    expected: 'files inside features/<name>/actions/, components/, hooks/, or utils/',
  },
  {
    scope: /^apps\/web\/src\/shared\/components\//,
    allow: (name) => /(\.test)?\.tsx$/.test(name),
    expected: '*.tsx',
  },
  {
    scope: /^apps\/web\/src\/shared\/utils\//,
    allow: (name) => /^[a-z0-9-]+(\.test)?\.ts$/.test(name),
    expected: '*.ts',
  },
  {
    scope: /^apps\/web\/src\/shared\//,
    allow: () => false,
    expected: 'shared/components/*.tsx or shared/utils/*.ts only (no hooks, actions, or API calls)',
  },
  {
    scope: /^apps\/web\/src\/components\/ui\//,
    allow: (name) => /(\.test)?\.tsx$/.test(name),
    expected: '*.tsx',
  },
  {
    scope: /^apps\/web\/src\/components\//,
    allow: () => false,
    expected: 'components/ui/*.tsx; app-specific shared display goes in src/shared/components/',
  },
  {
    scope: /^apps\/web\/src\/lib\/[^/]+$/,
    allow: (name) => /^[a-z0-9-]+(\.test)?\.ts$/.test(name),
    expected: '*.ts',
  },
  {
    scope: /^apps\/web\/src\/lib\//,
    allow: () => false,
    expected: 'lib/*.ts only (API client and session cookie)',
  },
  {
    scope: /^tests\/acceptance\//,
    allow: (name) => /^ac\d{2}-[a-z0-9-]+\.test\.ts$/.test(name) || name === 'README.md',
    expected: 'acNN-short-description.test.ts',
  },
  {
    scope: /^(apps|packages)\/[^/]+\/src\/.+\/index\.ts$/,
    allow: () => false,
    expected: 'no nested index.ts barrels; only <package>/src/index.ts',
  },
];

/**
 * Checks one path against the structure rules.
 *
 * @param {string} path - Repository-relative path.
 * @returns {string | null} A problem description, or null when the file is placed correctly.
 */
export function checkStructure(path) {
  const name = basename(path);
  if (name === '.gitkeep') {
    return null;
  }
  for (const rule of STRUCTURE_RULES) {
    const match = path.match(rule.scope);
    if (match) {
      return rule.allow(name, match)
        ? null
        : `misplaced or misnamed file; expected ${rule.expected}`;
    }
  }
  return null;
}
