/**
 * @file Commit message rules: Conventional Commits with a required scope.
 * @see docs/standards/08-git-and-pull-requests.md
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    'scope-enum': [
      2,
      'always',
      [
        'web',
        'api',
        'worker',
        'domain',
        'engine',
        'db',
        'api-contract',
        'assistant',
        'test-kit',
        'tests',
        'docs',
        'repo',
        'ci',
        'agents',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 72],
  },
};
