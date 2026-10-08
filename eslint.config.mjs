/**
 * @file Lint rules for the whole monorepo. Each block maps to a section of docs/standards.
 * @see docs/standards/README.md
 */
import js from '@eslint/js';
import checkFile from 'eslint-plugin-check-file';
import jsdoc from 'eslint-plugin-jsdoc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { LANGUAGE_SYNTAX_BANS, layerBoundaries } from './config/eslint/layer-boundaries.mjs';
import { webRules } from './config/eslint/web.mjs';
import { wiringRules } from './config/eslint/wiring.mjs';

export default tseslint.config(
  // ---- Ignored paths ----
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'packages/db/migrations/**',
      'docs/planning/**',
    ],
  },

  // ---- Base rules for every file ----
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['vitest.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { 'check-file': checkFile, jsdoc, 'simple-import-sort': simpleImportSort },
    rules: {
      // Size: short, readable files and functions (standards/01).
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 3],
      'max-depth': ['error', 3],
      complexity: ['error', 10],

      // Language rules (standards/02).
      // Import groups: node, external, @caa workspace, @/ app alias, relative (standards/02).
      'simple-import-sort/imports': [
        'error',
        { groups: [['^node:'], ['^@?\\w'], ['^@caa/'], ['^@/'], ['^\\.'], ['^.+\\.css$']] },
      ],
      'simple-import-sort/exports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'no-restricted-syntax': ['error', ...LANGUAGE_SYNTAX_BANS],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'import', format: null },
        { selector: 'variable', format: ['camelCase', 'PascalCase', 'UPPER_CASE'] },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'has', 'can', 'should', 'was', 'will'],
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: ['objectLiteralProperty', 'typeProperty'], format: null },
      ],

      // Comments (standards/03).
      'jsdoc/require-file-overview': ['error', { tags: { file: { mustExist: true } } }],
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: true },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSMethodSignature',
            'ExportNamedDeclaration > VariableDeclaration',
          ],
        },
      ],
      'jsdoc/require-description': 'error',
      'jsdoc/require-param': ['error', { checkDestructured: false }],
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': ['error', { publicOnly: true }],
      'jsdoc/require-returns-description': 'error',
      'jsdoc/check-tag-names': ['error', { definedTags: ['file', 'module', 'requirement', 'see'] }],
      'jsdoc/no-types': 'error',

      // File and folder naming (standards/01).
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx,mjs}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': [
        'error',
        {
          'packages/*/src/**/': 'KEBAB_CASE',
          'apps/!(web)/src/**/': 'KEBAB_CASE',
          // NOTE: Next.js route folders (`[studentId]`, `(group)`) follow the App Router case only.
          'apps/web/src/!(app)/**/': 'KEBAB_CASE',
          'apps/web/src/app/**/': 'NEXT_JS_APP_ROUTER_CASE',
        },
      ],
    },
  },

  // ---- Plain JavaScript config files (not type-checked) ----
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'jsdoc/no-types': 'off',
    },
  },

  // ---- Command-line scripts report to the terminal ----
  {
    files: ['scripts/**/*.mjs', '.claude/hooks/*.mjs'],
    rules: { 'no-console': 'off' },
  },

  // ---- Config files that tools require to use a default export ----
  {
    files: [
      '**/*.config.{ts,mjs}',
      'apps/web/src/app/**/{page,layout,loading,error,not-found,global-error}.tsx',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // ---- Layer boundaries (standards/01 and /05) ----
  ...layerBoundaries,
  ...wiringRules,

  // ---- Next.js web app (standards/06) ----
  ...webRules,

  // ---- Temporary exceptions ----
  {
    // TODO(#443): temporary exception recorded in standard 01 §Size; remove when the composition root is split.
    files: ['apps/api/src/container.ts'],
    rules: {
      'max-lines': ['error', { max: 260, skipBlankLines: true, skipComments: true }],
    },
  },

  // ---- Tests: longer bodies are fine; everything else still applies ----
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.test.mjs'],
    rules: {
      'max-lines-per-function': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-restricted-imports': 'off',
    },
  },
);
