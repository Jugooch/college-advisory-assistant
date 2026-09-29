/**
 * @file Tests for credit field names, parsing typed credits, range checks, and credit wording.
 */
import { describe, expect, it } from 'vitest';

import { SYNTHETIC_COURSES } from '@caa/test-kit';

import {
  creditFieldName,
  describeCreditRule,
  parseCreditText,
  readCreditChoice,
} from './credit-choice';

/** DEMO-IND 390's catalog range: 1 to 3 credits. */
const IND_390_RULE = {
  kind: 'VARIABLE',
  minCreditsHundredths: 100,
  maxCreditsHundredths: 300,
} as const;

describe('creditFieldName', () => {
  it('prefixes the course ID', () => {
    const { id } = SYNTHETIC_COURSES.ind390;

    expect(creditFieldName(id)).toBe(`credits-${id}`);
  });
});

describe('parseCreditText', () => {
  it.each([
    ['2', 200],
    ['2.5', 250],
    ['2.25', 225],
    [' 3 ', 300],
    ['0', 0],
    ['12.05', 1205],
  ])('parses %j as %d hundredths', (text, hundredths) => {
    expect(parseCreditText(text)).toBe(hundredths);
  });

  it.each(['', 'two', '2.555', '-1', '1e2', '.5', '2.', '1,2', '100'])('rejects %j', (text) => {
    expect(parseCreditText(text)).toBeNull();
  });
});

describe('readCreditChoice', () => {
  it.each([undefined, '', '   '])('treats %j as no value chosen, never a default', (text) => {
    expect(readCreditChoice(text, IND_390_RULE)).toEqual({ kind: 'blank' });
  });

  it.each([
    ['1', 100],
    ['2.5', 250],
    ['3', 300],
  ])('accepts %j within the range', (text, hundredths) => {
    expect(readCreditChoice(text, IND_390_RULE)).toEqual({ kind: 'chosen', hundredths });
  });

  it.each(['0.5', '3.01', '4'])('rejects %j outside the range with the range', (text) => {
    expect(readCreditChoice(text, IND_390_RULE)).toEqual({
      kind: 'invalid',
      message: 'Enter a number from 1 to 3.',
    });
  });

  it('rejects text that is not a number of credits', () => {
    expect(readCreditChoice('two', IND_390_RULE)).toEqual({
      kind: 'invalid',
      message: 'Enter a number of credits, such as 2 or 2.5.',
    });
  });
});

describe('describeCreditRule', () => {
  it.each([
    [{ kind: 'FIXED', creditsHundredths: 300 } as const, '3 credits'],
    [{ kind: 'FIXED', creditsHundredths: 100 } as const, '1 credit'],
    [IND_390_RULE, '1 to 3 credits, your choice'],
    [
      { kind: 'VARIABLE', minCreditsHundredths: 50, maxCreditsHundredths: 100 } as const,
      '0.5 to 1 credit, your choice',
    ],
  ])('describes %j as %j', (rule, text) => {
    expect(describeCreditRule(rule)).toBe(text);
  });
});
