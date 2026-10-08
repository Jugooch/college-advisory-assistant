/**
 * @file Tests for the pure policy search: tokens, stop words, scoring, ranking, excerpts and
 * conflict marking.
 * @requirement FR-16
 * @requirement AC42
 */
import { describe, expect, it } from 'vitest';

import { PolicyTopic } from '@caa/domain';
import { buildPolicyDocument } from '@caa/test-kit';

import { excerptOf, scoreDocument, searchPolicies, tokenize } from './policy-search.logic';

describe('tokenize', () => {
  it('lower-cases, splits on non-letters and digits, and drops stop words', () => {
    expect(tokenize('What is the Late-Registration fee, for 2026?')).toEqual([
      'late',
      'registration',
      'fee',
      '2026',
    ]);
  });
});

describe('scoreDocument', () => {
  it('counts distinct query tokens, twice in the title and once in the body', () => {
    const document = buildPolicyDocument({
      title: 'Late registration',
      body: 'Register late with the registrar. Late again.',
    });

    expect(scoreDocument(['late', 'registrar', 'fee'], document)).toBe(2 + 1 + 1);
  });
});

describe('searchPolicies', () => {
  const alpha = buildPolicyDocument(
    {
      documentKey: 'alpha',
      subjectKey: 'a',
      title: 'Withdrawal',
      body: 'Withdraw by the deadline.',
    },
    1,
  );
  const beta = buildPolicyDocument(
    { documentKey: 'beta', subjectKey: 'b', title: 'Other', body: 'Withdrawal deadline details.' },
    2,
  );
  const gamma = buildPolicyDocument(
    { documentKey: 'gamma', subjectKey: 'c', title: 'Other', body: 'Withdrawal deadline details.' },
    3,
  );

  it('ranks by score then breaks ties by documentKey', () => {
    const titleHit = buildPolicyDocument(
      { documentKey: 'zeta', subjectKey: 'z', title: 'Withdrawal rules', body: 'Nothing.' },
      4,
    );

    const result = searchPolicies([gamma, beta, titleHit], { q: 'withdrawal' });

    expect(result.map((match) => [match.document.documentKey, match.score])).toEqual([
      ['zeta', 2],
      ['beta', 1],
      ['gamma', 1],
    ]);
  });

  it('returns at most three hits and none with a score of zero', () => {
    const extra = buildPolicyDocument(
      { documentKey: 'delta', subjectKey: 'd', body: 'Withdrawal.' },
      5,
    );
    const unrelated = buildPolicyDocument(
      { documentKey: 'eps', subjectKey: 'e', body: 'Parking.' },
      6,
    );

    const result = searchPolicies([alpha, beta, gamma, extra, unrelated], { q: 'withdrawal' });

    expect(result.map((match) => match.document.documentKey)).toEqual(['alpha', 'beta', 'delta']);
    expect(searchPolicies([unrelated], { q: 'withdrawal' })).toEqual([]);
  });

  it('returns nothing for a query made only of stop words', () => {
    expect(searchPolicies([alpha], { q: 'what is the' })).toEqual([]);
  });

  it('filters by topic, and lists a topic by documentKey when there is no text', () => {
    const aid = buildPolicyDocument({ documentKey: 'aid-b', topic: PolicyTopic.FinancialAid }, 7);
    const aidTwo = buildPolicyDocument(
      { documentKey: 'aid-a', topic: PolicyTopic.FinancialAid },
      8,
    );

    expect(
      searchPolicies([alpha, aid, aidTwo], { topic: PolicyTopic.FinancialAid }).map(
        (match) => match.document.documentKey,
      ),
    ).toEqual(['aid-a', 'aid-b']);
    expect(
      searchPolicies([alpha, aid], { q: 'withdraw', topic: PolicyTopic.FinancialAid }),
    ).toEqual([]);
  });

  it('marks both hits that share a subjectKey as conflicting, and no others', () => {
    const left = buildPolicyDocument(
      { documentKey: 'x1', subjectKey: 'same', body: 'Refund in 10 days.' },
      9,
    );
    const right = buildPolicyDocument(
      { documentKey: 'x2', subjectKey: 'same', body: 'Refund in 30 days.' },
      10,
    );

    const result = searchPolicies([left, right, alpha], { q: 'refund withdraw' });

    expect(result.map((match) => [match.document.documentKey, match.conflict])).toEqual([
      ['alpha', false],
      ['x1', true],
      ['x2', true],
    ]);
  });

  it('gives identical output for identical input', () => {
    const run = () => searchPolicies([gamma, beta, alpha], { q: 'withdrawal deadline' });

    expect(run()).toEqual(run());
  });
});

describe('excerptOf', () => {
  it('picks the paragraph with the most distinct query tokens', () => {
    const body = 'Intro about parking.\n\nWithdrawal deadline rules apply.\n\nWithdrawal only.';

    expect(excerptOf(['withdrawal', 'deadline'], body)).toBe('Withdrawal deadline rules apply.');
  });

  it('cuts a long paragraph at a word boundary to at most 500 characters', () => {
    const body = `${'word '.repeat(150)}end`;

    const excerpt = excerptOf(['word'], body);

    expect(excerpt.length).toBeLessThanOrEqual(500);
    expect(excerpt).toBe('word '.repeat(100).trim());
  });

  it('cuts mid-word only when there is no whitespace to cut at', () => {
    expect(excerptOf(['x'], 'y'.repeat(600))).toBe('y'.repeat(500));
  });
});
