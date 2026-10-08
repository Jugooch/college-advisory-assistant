/**
 * @file Tests for the intro templates.
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockKind } from '@caa/domain';

import { guardIntro } from '../guards/output.guard';
import { fallbackIntro } from './intro.template';

describe('fallbackIntro', () => {
  it('picks a fallback intro from the block kinds, with a default', () => {
    expect(fallbackIntro([AssistantBlockKind.ScheduleOptions])).toBe(
      'Here are your schedule options. Each card shows its own checks.',
    );
    expect(fallbackIntro([AssistantBlockKind.Notice, AssistantBlockKind.ScheduleOptions])).toBe(
      'Here are your schedule options. Each card shows its own checks.',
    );
    expect(fallbackIntro([])).toBe('Please see the note below.');
  });

  it('every fallback intro passes the output guard', () => {
    for (const kind of Object.values(AssistantBlockKind)) {
      expect(guardIntro(fallbackIntro([kind])).ok).toBe(true);
    }
  });
});
