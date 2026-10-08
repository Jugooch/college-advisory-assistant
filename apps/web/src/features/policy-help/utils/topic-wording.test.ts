/**
 * @file Tests for the where-to-ask topic order and labels.
 */
import { describe, expect, it } from 'vitest';

import { SpecialistTopic } from '@caa/domain';

import { describeTopic, WHERE_TO_ASK_TOPICS } from './topic-wording';

describe('topic wording', () => {
  it('lists crisis first and every specialist topic once', () => {
    expect(WHERE_TO_ASK_TOPICS[0]).toBe('CRISIS');
    expect([...WHERE_TO_ASK_TOPICS].sort()).toEqual(Object.values(SpecialistTopic).sort());
  });

  it('labels every topic', () => {
    for (const topic of WHERE_TO_ASK_TOPICS) {
      expect(describeTopic(topic).length).toBeGreaterThan(0);
    }
  });
});
