/**
 * @file Tests that the planner page starts its independent lookups together.
 * @module @caa/web/shared/components/planner-page-lookups.test
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAcademicSummary: vi.fn(),
  getPlannableTerms: vi.fn(),
  getConversation: vi.fn(),
  findScheduleOptions: vi.fn(),
}));

vi.mock('@/api/academic-summary.api', () => ({ getAcademicSummary: mocks.getAcademicSummary }));
vi.mock('@/api/plannable-terms.api', () => ({ getPlannableTerms: mocks.getPlannableTerms }));
vi.mock('@/api/conversation.api', () => ({ getConversation: mocks.getConversation }));
vi.mock('@/api/schedule-options.api', () => ({ findScheduleOptions: mocks.findScheduleOptions }));

import NextTermPlannerPage from '@/app/next-term-planner/page';

const STUDENT_ID = '3f1c2b7e-8a4d-4c1e-9b6a-2d5e7f801234';

describe('NextTermPlannerPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts the summary and terms lookups before either resolves', async () => {
    mocks.getAcademicSummary.mockReturnValue(new Promise(() => undefined));
    mocks.getPlannableTerms.mockReturnValue(new Promise(() => undefined));

    void NextTermPlannerPage({ searchParams: Promise.resolve({ studentId: STUDENT_ID }) });
    await vi.waitFor(() => {
      expect(mocks.getAcademicSummary).toHaveBeenCalledTimes(1);
      expect(mocks.getPlannableTerms).toHaveBeenCalledTimes(1);
    });
    expect(mocks.getConversation).not.toHaveBeenCalled();
    expect(mocks.findScheduleOptions).not.toHaveBeenCalled();
  });
});
