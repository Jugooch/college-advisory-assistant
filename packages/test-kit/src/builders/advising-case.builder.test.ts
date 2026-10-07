/**
 * @file Tests for the synthetic advising case builders.
 */
import { describe, expect, it } from 'vitest';

import { AdvisingCaseSchema } from '@caa/domain';

import {
  buildAdvisingCase,
  buildInReviewAdvisingCase,
  buildResolvedAdvisingCase,
} from './advising-case.builder';
import { buildInReviewCaseEvents, buildResolvedCaseEvents } from './case-event.builder';

describe('buildAdvisingCase', () => {
  it('defaults to an OPEN plan-review case with no owner', () => {
    expect(buildAdvisingCase()).toEqual({
      id: 'f0000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      studentId: '30000000-0000-4000-8000-000000000001',
      reason: 'PLAN_REVIEW',
      planRevisionId: 'e1000000-0000-4000-8000-000000000001',
      discrepancySubject: null,
      studentNote: 'Please check this plan before I register.',
      status: 'OPEN',
      ownerUserId: null,
      createdAt: '2026-09-22T10:00:00.000-05:00',
      lastSequence: 1,
    });
  });

  it('derives the id from the seed and applies overrides', () => {
    const advisingCase = buildAdvisingCase(
      { reason: 'SOURCE_DISCREPANCY', planRevisionId: null, discrepancySubject: 'SECTION' },
      6,
    );

    expect(advisingCase.id).toBe('f0000000-0000-4000-8000-000000000006');
    expect(advisingCase.discrepancySubject).toBe('SECTION');
  });

  it('rejects an OPEN case that has an owner', () => {
    expect(() =>
      buildAdvisingCase({ ownerUserId: '20000000-0000-4000-8000-000000000002' }),
    ).toThrow();
  });
});

describe('buildInReviewAdvisingCase', () => {
  it('is IN_REVIEW with an owner and matches the last event of its history', () => {
    const advisingCase = buildInReviewAdvisingCase();
    const events = buildInReviewCaseEvents();

    expect(AdvisingCaseSchema.safeParse(advisingCase).success).toBe(true);
    expect(advisingCase.status).toBe('IN_REVIEW');
    expect(advisingCase.ownerUserId).toBe('20000000-0000-4000-8000-000000000002');
    expect(advisingCase.lastSequence).toBe(events.at(-1)?.sequence);
    expect(advisingCase.status).toBe(events.at(-1)?.toStatus);
  });
});

describe('buildResolvedAdvisingCase', () => {
  it('is RESOLVED with an owner and matches the last event of its history', () => {
    const advisingCase = buildResolvedAdvisingCase();
    const events = buildResolvedCaseEvents();

    expect(AdvisingCaseSchema.safeParse(advisingCase).success).toBe(true);
    expect(advisingCase.status).toBe('RESOLVED');
    expect(advisingCase.ownerUserId).not.toBeNull();
    expect(advisingCase.lastSequence).toBe(events.at(-1)?.sequence);
    expect(advisingCase.status).toBe(events.at(-1)?.toStatus);
  });
});
