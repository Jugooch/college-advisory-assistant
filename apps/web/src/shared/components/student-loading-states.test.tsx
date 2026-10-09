/**
 * @file Tests that every student loading state is a status region with its page's heading.
 * @module @caa/web/shared/components/student-loading-states.test
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import AskLoading from '@/app/ask-an-advisor/loading';
import CourseChecksLoading from '@/app/course-checks/loading';
import HelpLoading from '@/app/help-and-cases/loading';
import PlanDetailLoading from '@/app/my-plans/[planId]/loading';
import MyPlansLoading from '@/app/my-plans/loading';
import PlannerLoading from '@/app/next-term-planner/loading';
import OverviewLoading from '@/app/overview/loading';

const CASES = [
  ['Overview', OverviewLoading],
  ['Plan next term', PlannerLoading],
  ['My plans', MyPlansLoading],
  ['Plan detail', PlanDetailLoading],
  ['Course checks', CourseChecksLoading],
  ['Ask an advisor', AskLoading],
  ['Help and cases', HelpLoading],
] as const;

describe('student loading states', () => {
  afterEach(cleanup);

  it.each(CASES)(
    '%s shows its heading inside a status region with text',
    async (heading, loadingPage) => {
      const { container } = render(loadingPage());
      const status = screen.getByRole('status');
      expect(status.querySelector('h1')?.textContent).toBe(heading);
      expect(status.querySelector('p')?.textContent).toMatch(/^Loading .*will appear/);
      expect((await axe.run(container)).violations).toEqual([]);
    },
  );
});
