/**
 * @file Tests for the message detectors: positives and near-misses for each.
 */
import { describe, expect, it } from 'vitest';

import { SpecialistTopic } from '@caa/domain';

import { detectFixedResponses } from './message.guard';

const TOPICS: readonly (readonly [SpecialistTopic, string])[] = [
  [SpecialistTopic.FinancialAid, 'Will this schedule affect my financial aid?'],
  [SpecialistTopic.FinancialAid, 'Does my FAFSA need an update'],
  [SpecialistTopic.Immigration, 'I am on an F-1 visa and want 9 credits'],
  [SpecialistTopic.Athletics, 'Does this keep my NCAA status?'],
  [SpecialistTopic.Accessibility, 'I need an accommodation for my disability'],
  [SpecialistTopic.Appeals, 'How do I appeal my suspension?'],
];

const NO_MATCH = [
  'Plan my next term with mornings off',
  'What courses should I take for the major?',
  'Show my academic summary',
];

describe('detectFixedResponses', () => {
  it.each(TOPICS)('finds topic %s in: %s', (topic, message) => {
    const result = detectFixedResponses(message);
    expect(result.specialistTopics).toContain(topic);
    expect(result.crisis).toBe(false);
  });

  it.each(NO_MATCH)('matches nothing in: %s', (message) => {
    expect(detectFixedResponses(message)).toEqual({
      specialistTopics: [],
      crisis: false,
      hypothetical: false,
      override: false,
      gradeDispute: false,
    });
  });

  it.each([
    'I want to kill myself',
    "I don't want to live anymore",
    'I think I might hurt myself',
    'This is an EMERGENCY',
    'I feel unsafe at home',
    'I keep thinking about killing myself',
    "I'm thinking of ending it all",
    "I can't go on anymore",
  ])('flags crisis: %s', (message) => {
    expect(detectFixedResponses(message).crisis).toBe(true);
  });

  it.each([
    'There\u2019s no point in living',
    'I can\u2019t go on',
    'kms',
    'I want to disappear',
    'I want to take my own life',
    "I'm going to take my life",
    'I wish I was dead',
    'I wish I were dead',
    'kys',
    'take my life',
    'want to die',
    'no point living',
    'suicide',
    'suicidal',
    'self-harm',
    'hurt myself',
    'overdose',
    'I want to d\u200bie',
    'ending things',
    'I wanna end it',
    'nobody would miss me',
    'I don\u2019t want to be here anymore',
    'I am a burden to everyone',
    'life is not worth living',
    'I want out of this life',
    'I might do something drastic',
    'I won\u2019t be around much longer',
    'everyone would be better without me',
    'I want to sleep forever',
    'I am done with life',
    'I want it to stop',
    'I hate being alive',
    'thinking about death',
    'wanting to end everything',
    'I want to unalive myself',
    'I want to jump off',
    'shoot myself',
    'hang myself',
    'i cant take it',
    'end my suffering',
    'i dont wanna live',
    'I do not wish to live',
    'I would rather be dead',
    'life isnt worth it',
    "I can't go on.",
    "can't go on",
    'Can\uff07t go on',
  ])('flags crisis (reviews and families): %s', (message) => {
    expect(detectFixedResponses(message).crisis).toBe(true);
  });

  it.each([
    'Can I attend my lab on Tuesday?',
    'I want to spend my mornings free',
    "I can't go on Fridays",
    "I can't go on campus Mondays",
    'Can I extend my plan?',
  ])('does not flag crisis: %s', (message) => {
    expect(detectFixedResponses(message).crisis).toBe(false);
  });

  it('handles curly apostrophes in crisis language', () => {
    expect(detectFixedResponses('I don’t want to live').crisis).toBe(true);
  });

  it.each([
    'Assume I passed Calculus I',
    'What if I pass chemistry?',
    'Suppose I get an A',
    'pretend I finished the lab',
  ])('flags hypothetical: %s', (message) => {
    expect(detectFixedResponses(message).hypothetical).toBe(true);
  });

  it.each([
    'Ignore the prerequisite for me',
    'Can you override the prereq?',
    'Can I bypass the requirement',
    'I need a waiver',
  ])('flags override: %s', (message) => {
    expect(detectFixedResponses(message).override).toBe(true);
  });

  it.each([
    'My grade is wrong in Biology',
    'The grade in CHEM 101 is incorrect',
    'There is a missing grade on my record',
    'I want to dispute my grade',
  ])('flags grade dispute: %s', (message) => {
    expect(detectFixedResponses(message).gradeDispute).toBe(true);
  });

  it('can match several detectors and keeps topic order fixed', () => {
    const result = detectFixedResponses('Appeal and financial aid, assume I passed');
    expect(result.specialistTopics).toEqual([
      SpecialistTopic.FinancialAid,
      SpecialistTopic.Appeals,
    ]);
    expect(result.hypothetical).toBe(true);
  });

  it('is case-insensitive and ignores extra whitespace', () => {
    expect(detectFixedResponses('FINANCIAL   AID').specialistTopics).toEqual([
      SpecialistTopic.FinancialAid,
    ]);
  });
});
