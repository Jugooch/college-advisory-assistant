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
    expect(result.crisis).toBe('NONE');
  });

  it.each(NO_MATCH)('matches nothing in: %s', (message) => {
    expect(detectFixedResponses(message)).toEqual({
      specialistTopics: [],
      crisis: 'NONE',
      hypothetical: false,
      override: false,
      gradeDispute: false,
    });
  });

  it.each([
    'I want to kill myself',
    'I keep thinking about killing myself',
    "I'm going to kill myself tonight",
    'I feel suicidal',
    'I want to end my life',
    'I want to end my own life',
    'I want to take my own life',
    "I'm going to take my life",
    'I want to die',
    'I wanna die',
    'I wish I was dead',
    'I wish I were dead',
    'everyone is better off dead',
    'I think I might hurt myself',
    'kms',
    'KMS',
    'I want to kill mys\u200belf',
    'I want to d\u200bie',
  ])('tier 1 (unambiguous): %s', (message) => {
    expect(detectFixedResponses(message).crisis).toBe('UNAMBIGUOUS');
  });

  it.each([
    "I can't take this class until spring",
    "I can't take it in the fall",
    'Are there exams during dead week?',
    'Should I take Death and Dying?',
    'Can I jump from MATH 101 to MATH 201?',
    'Am I in danger of academic probation?',
    "I can't go on Fridays",
    "I can't go on campus Mondays",
    "I can't go on anymore",
    "I can't go on this way",
    "I can't go on at this point",
    'There\u2019s no point in living',
    'I want to disappear',
    'I don\u2019t want to be here anymore',
    "I don't want to live anymore",
    'suicide',
    'self-harm',
    'overdose',
    'I am a burden to everyone',
    'I want to give up on life',
    'nobody would miss me',
    'life is not worth living',
    'I might do something drastic',
    'I feel unsafe at home',
    'This is an EMERGENCY',
    "I'm thinking of ending it all",
    'Can\uff07t go on',
    'I feel hopeless',
    'There is no point',
    "There's no point anymore",
    'I just want to give up',
  ])('tier 2 (ambiguous), never tier 1: %s', (message) => {
    expect(detectFixedResponses(message).crisis).toBe('AMBIGUOUS');
  });

  it('tier 1 wins when both tiers match', () => {
    expect(detectFixedResponses("I'm a burden and I want to kill myself").crisis).toBe(
      'UNAMBIGUOUS',
    );
  });

  it.each([
    'Can I attend my lab on Tuesday?',
    'I want to spend my mornings free',
    'Can I extend my plan?',
    'Plan my term with no Friday classes',
  ])('is not crisis: %s', (message) => {
    expect(detectFixedResponses(message).crisis).toBe('NONE');
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
