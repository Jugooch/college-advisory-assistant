/**
 * @file Import and determinism rules for the API composition root: `container.ts` and the
 * `wiring/<area>.wiring.ts` files it calls (ADR-0014).
 * @module config/eslint/wiring
 * @see docs/standards/01-repository-structure.md
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import { determinismBans } from './determinism.mjs';
import { appForbid, LANGUAGE_SYNTAX_BANS, otherApps } from './layer-boundaries.mjs';

/** Why a `.wiring.ts` file may not import another layer or framework (ADR-0014). */
const WIRING_MESSAGE =
  'Wiring files only construct one area (ADR-0014): no other wiring, routes, plugins, app, server, Fastify, or SQL.';

/** Flat-config blocks for the composition root; they follow `layerBoundaries`. */
export const wiringRules = [
  {
    // The composition root builds the graph and calls each wiring file once (ADR-0014).
    files: ['apps/api/src/container.ts'],
    rules: {
      'no-restricted-imports': appForbid(otherApps('api'), 'The API does not import other apps.'),
    },
  },
  {
    // SAFETY: wiring only constructs; no I/O, clock, or environment reads (ADR-0014, NFR-01).
    files: ['apps/api/src/wiring/*.wiring.ts'],
    rules: {
      'no-restricted-imports': appForbid(
        [
          '**/*.wiring',
          '**/*.routes',
          '**/plugins/*',
          '**/app',
          '**/server',
          'fastify',
          'drizzle-orm',
          'drizzle-orm/*',
          'pg',
          ...otherApps('api'),
        ],
        WIRING_MESSAGE,
      ),
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/container'],
              allowTypeImports: true,
              message: 'Wiring files import only types from container.ts (ADR-0014).',
            },
            {
              group: ['@caa/db'],
              allowTypeImports: true,
              message: 'Wiring files import only types from @caa/db; repositories arrive by name.',
            },
          ],
        },
      ],
      ...determinismBans(
        LANGUAGE_SYNTAX_BANS,
        'Wiring reads no clock; take the clock function as a parameter (ADR-0014).',
      ),
    },
  },
];
