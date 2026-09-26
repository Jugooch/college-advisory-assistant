/**
 * @file Rules for the Next.js web app: React, accessibility, and its import boundaries.
 * @see docs/standards/06-frontend.md
 */
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import { forbid, SERVER_ONLY } from './layer-boundaries.mjs';

/** Configuration blocks for apps/web. */
export const webRules = [
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      ...jsxA11y.flatConfigs.strict.plugins,
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ...jsxA11y.flatConfigs.strict.languageOptions,
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-restricted-imports': forbid(
        [...SERVER_ONLY, 'fastify'],
        'The web app reaches data only through the API.',
      ),
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Call the API through src/api/*.api.ts.' },
      ],
    },
  },
  {
    files: ['apps/web/src/components/**', 'apps/web/src/features/*/components/**'],
    rules: {
      'no-restricted-imports': forbid(
        [...SERVER_ONLY, 'fastify', '@/api/*'],
        'Components receive data via props or hooks.',
      ),
    },
  },
];
