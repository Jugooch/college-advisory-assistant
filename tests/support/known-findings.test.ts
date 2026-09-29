/**
 * @file Proves the known-findings register helpers: a listed key runs as an expected failure
 *   naming its issue, any other key runs as a plain test, and acceptance declarations are found in
 *   source whichever quotes Prettier chose.
 * @requirement NFR-01
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import {
  declaredAcceptanceKeys,
  FINDING_KEY,
  findingMode,
  HARD_CODED_EXPECTED_FAILURE,
} from './known-findings';

const REGISTER: ReadonlyMap<string, number> = new Map([
  ['GC-PF-004', 183],
  ['AC29: keeps CONDITIONAL end to end', 200],
]);

describe('findingMode', () => {
  it('makes a listed golden case an expected failure naming its issue', () => {
    expect(findingMode('GC-PF-004', REGISTER)).toEqual({ kind: 'expected-failure', issue: 183 });
  });

  it('makes a listed acceptance test an expected failure naming its issue', () => {
    expect(findingMode('AC29: keeps CONDITIONAL end to end', REGISTER)).toEqual({
      kind: 'expected-failure',
      issue: 200,
    });
  });

  it('makes an unlisted key a plain test', () => {
    expect(findingMode('GC-PF-005', REGISTER)).toEqual({ kind: 'test' });
  });
});

describe('declaredAcceptanceKeys', () => {
  it('finds single-quoted, double-quoted, and wrapped declarations in source order', () => {
    const source = [
      "acceptanceIt('AC29', 'keeps CONDITIONAL end to end', async () => {});",
      "acceptanceIt('AC30', \"does not deny another program’s student's course\", () => {});",
      'acceptanceIt(',
      "  'AC31',",
      "  'replays deep-equal',",
      '  async () => {},',
      ');',
    ].join('\n');

    expect(declaredAcceptanceKeys(source)).toEqual([
      'AC29: keeps CONDITIONAL end to end',
      "AC30: does not deny another program’s student's course",
      'AC31: replays deep-equal',
    ]);
  });

  it('ignores plain it calls', () => {
    expect(declaredAcceptanceKeys("it('keeps CONDITIONAL end to end', () => {});")).toEqual([]);
  });
});

describe('HARD_CODED_EXPECTED_FAILURE', () => {
  it.each([
    "it.fails('keeps CONDITIONAL', () => {});",
    "test.fails('keeps CONDITIONAL', () => {});",
    "it.fails.each([1, 2])('case %s', () => {});",
    "test.fails.each([1, 2])('case %s', () => {});",
  ])('catches %s', (source) => {
    expect(HARD_CODED_EXPECTED_FAILURE.test(source)).toBe(true);
  });

  it.each([
    "it('keeps CONDITIONAL', () => {});",
    "itForFinding('GC-PF-004', 'GC-PF-004', () => {});",
    'const fit.failsafe = true;',
    'splitFails(result);',
  ])('ignores %s', (source) => {
    expect(HARD_CODED_EXPECTED_FAILURE.test(source)).toBe(false);
  });
});

describe('FINDING_KEY', () => {
  it.each(['GC-PF-004', 'GH-ALLOC-003', 'AC29: keeps CONDITIONAL end to end'])(
    'accepts %s',
    (key) => {
      expect(FINDING_KEY.test(key)).toBe(true);
    },
  );

  it.each(['GC-PF-4', 'AC29', 'AC29 keeps CONDITIONAL', 'ac29: keeps'])('rejects %s', (key) => {
    expect(FINDING_KEY.test(key)).toBe(false);
  });
});
