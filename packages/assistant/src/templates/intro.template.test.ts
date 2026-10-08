/**
 * @file Tests for the intro templates and resolveIntro.
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockKind } from '@caa/domain';

import { fallbackIntro, GuardReason, INTRO_TEXTS, IntroId, resolveIntro } from './intro.template';

const SCHEDULE = 'Here are your schedule options. Each card shows its own checks.';

const WITH_BLOCK: readonly (readonly [IntroId, AssistantBlockKind, string])[] = [
  [IntroId.ScheduleOptions, AssistantBlockKind.ScheduleOptions, SCHEDULE],
  [
    IntroId.PlanEvidence,
    AssistantBlockKind.PlanEvidence,
    'Here is your plan. The card shows its own checks and when they were run.',
  ],
  [
    IntroId.AcademicSummary,
    AssistantBlockKind.AcademicSummary,
    'Here is your academic summary, as shown on your record.',
  ],
  [
    IntroId.PolicyResults,
    AssistantBlockKind.PolicyResults,
    'Here are the policy documents that match your question.',
  ],
  [
    IntroId.ConstraintProposal,
    AssistantBlockKind.ConstraintProposal,
    'Here are the planning choices I understood. Please review them before continuing.',
  ],
  [
    IntroId.CasePreview,
    AssistantBlockKind.CasePreview,
    'Here is a preview of the case. Nothing is sent until you confirm it.',
  ],
];

const ASK = 'Could you tell me a little more about what you would like to plan or look up?';
const CANNOT = 'I cannot help with that here. You can use the planning form or ask your advisor.';

describe('intro sentences', () => {
  it('are the exact fixed sentences', () => {
    for (const [id, , text] of WITH_BLOCK) {
      expect(INTRO_TEXTS[id]).toBe(text);
    }
    expect(INTRO_TEXTS[IntroId.AskForDetail]).toBe(ASK);
    expect(INTRO_TEXTS[IntroId.CannotHelp]).toBe(CANNOT);
  });

  it('has exactly 8 ids', () => {
    expect(Object.values(IntroId)).toHaveLength(8);
  });

  it('are printable ASCII, at most 600 characters, and free of academic facts', () => {
    for (const text of Object.values(INTRO_TEXTS)) {
      expect(text).toMatch(/^[\x20-\x7e]+$/);
      expect(text.length).toBeLessThanOrEqual(600);
      expect(text).not.toMatch(
        /\d|credit|grade|eligib|prerequisite|deadline|ready|registered|will contact/i,
      );
    }
  });
});

describe('fallbackIntro', () => {
  it('picks by block kind with precedence, a default, and ask-for-detail when empty', () => {
    expect(fallbackIntro([AssistantBlockKind.ScheduleOptions])).toBe(SCHEDULE);
    expect(fallbackIntro([AssistantBlockKind.Notice, AssistantBlockKind.ScheduleOptions])).toBe(
      SCHEDULE,
    );
    expect(fallbackIntro([AssistantBlockKind.Notice])).toBe('Please see the note below.');
    expect(fallbackIntro([])).toBe(ASK);
  });
});

describe('resolveIntro', () => {
  it.each(WITH_BLOCK)('accepts %s with its block', (id, kind, text) => {
    expect(resolveIntro(id, [kind])).toEqual({ text, introId: id, reasons: [] });
  });

  it.each(WITH_BLOCK)('rejects %s without its block', (id) => {
    expect(resolveIntro(id, [AssistantBlockKind.Notice])).toEqual({
      text: 'Please see the note below.',
      introId: null,
      reasons: [GuardReason.IntroBlockMissing],
    });
  });

  it('trims the reply before matching', () => {
    expect(resolveIntro('  SCHEDULE_OPTIONS\n', [AssistantBlockKind.ScheduleOptions]).introId).toBe(
      IntroId.ScheduleOptions,
    );
  });

  it('accepts ASK_FOR_DETAIL and CANNOT_HELP with no data block', () => {
    expect(resolveIntro('ASK_FOR_DETAIL', [])).toEqual({
      text: ASK,
      introId: IntroId.AskForDetail,
      reasons: [],
    });
    expect(resolveIntro('CANNOT_HELP', [AssistantBlockKind.Notice])).toEqual({
      text: CANNOT,
      introId: IntroId.CannotHelp,
      reasons: [],
    });
  });

  it('rejects ASK_FOR_DETAIL and CANNOT_HELP when a data block exists', () => {
    for (const id of ['ASK_FOR_DETAIL', 'CANNOT_HELP']) {
      expect(resolveIntro(id, [AssistantBlockKind.PlanEvidence])).toEqual({
        text: fallbackIntro([AssistantBlockKind.PlanEvidence]),
        introId: null,
        reasons: [GuardReason.IntroBlockMissing],
      });
    }
  });

  it.each([
    ['prose', 'You are eligible for MATH 201.'],
    ['an id plus text', 'SCHEDULE_OPTIONS You are eligible.'],
    ['two ids', 'SCHEDULE_OPTIONS PLAN_EVIDENCE'],
    ['an empty reply', ''],
    ['whitespace', '   '],
    ['an unknown id', 'SOMETHING_ELSE'],
    ['a lowercase id', 'schedule_options'],
  ])('falls back for %s', (_label, reply) => {
    const kinds = [AssistantBlockKind.ScheduleOptions];
    expect(resolveIntro(reply, kinds)).toEqual({
      text: SCHEDULE,
      introId: null,
      reasons: [GuardReason.IntroNotAnId],
    });
  });

  it('falls back to ask-for-detail with no blocks', () => {
    expect(resolveIntro('hello', [])).toEqual({
      text: ASK,
      introId: null,
      reasons: [GuardReason.IntroNotAnId],
    });
  });

  it('has exactly the three reason codes', () => {
    expect(Object.values(GuardReason)).toEqual([
      'INTRO_NOT_AN_ID',
      'INTRO_BLOCK_MISSING',
      'CRISIS_UNAMBIGUOUS',
    ]);
  });
});
