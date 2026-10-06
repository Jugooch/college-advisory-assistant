/**
 * @file Tests for the schedule-option builders: valid contract-shaped defaults, bundles with an
 *   included lab, and a loud failure for an option the contract rejects.
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { describe, expect, it } from 'vitest';

import { CheckKind, CheckState } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import {
  buildScheduledSection,
  buildScheduleOption,
  buildSectionBundle,
} from './schedule-option.builder';
import { buildSection } from './section.builder';

const { phys201, phys201Lab } = SYNTHETIC_COURSES;

describe('buildScheduleOption', () => {
  it('builds a validated rank-1 option of one 3.00-credit DEMO-MATH 102 bundle', () => {
    expect(buildScheduleOption()).toMatchObject({
      rank: 1,
      bundles: [
        {
          courseId: '50000000-0000-4000-8000-000000000102',
          creditsCountedHundredths: 300,
          sections: [
            {
              sectionId: 'c0000000-0000-4000-8000-000000000001',
              sectionCode: '001',
              countsCredits: true,
            },
          ],
        },
      ],
      scheduleFeasibility: { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' },
      courseResults: [{ courseId: '50000000-0000-4000-8000-000000000102', prerequisite: null }],
      setResults: {
        creditLoad: { state: 'PASS', evidence: { creditLoad: { totalCreditsHundredths: 300 } } },
      },
      linkedCourseResults: [],
      unmetPreferences: [],
      aggregate: 'VALIDATED',
    });
  });

  it('follows given bundles with its course results and credit load', () => {
    const lecture = buildSection({ courseId: phys201.id }, 11);
    const lab = buildScheduledSection(buildSection({ courseId: phys201Lab.id }, 12), false);

    const option = buildScheduleOption({ bundles: [buildSectionBundle([lecture, lab], 400)] });

    expect(option.bundles[0]?.sections.map((section) => section.countsCredits)).toEqual([
      true,
      false,
    ]);
    expect(option.courseResults.map((result) => result.courseId)).toEqual([phys201.id]);
    expect(option.setResults.creditLoad.evidence?.creditLoad?.totalCreditsHundredths).toBe(400);
  });

  it('keeps an UNKNOWN schedule with a NEEDS_VERIFICATION aggregate', () => {
    const unknown = buildScheduleOption({
      bundles: [buildSectionBundle([buildSection()], null)],
      scheduleFeasibility: {
        kind: CheckKind.ScheduleFeasibility,
        state: CheckState.Unknown,
        reasonCode: 'VARIABLE_CREDIT_UNSELECTED',
      },
      setResults: {
        allocation: [{ kind: CheckKind.RequirementAllocation, state: CheckState.Pass }],
        creditLoad: {
          kind: CheckKind.CreditLoad,
          state: CheckState.Unknown,
          reasonCode: 'VARIABLE_CREDIT_UNSELECTED',
        },
      },
      aggregate: 'NEEDS_VERIFICATION',
    });

    expect(unknown.aggregate).toBe('NEEDS_VERIFICATION');
  });

  it('fails where it is built when the aggregate contradicts the checks', () => {
    expect(() =>
      buildScheduleOption({
        scheduleFeasibility: {
          kind: CheckKind.ScheduleFeasibility,
          state: CheckState.Unknown,
          reasonCode: 'TRANSITION_TIME_UNDEFINED',
        },
      }),
    ).toThrow(/aggregate must follow the FAIL, UNKNOWN, CONDITIONAL, PASS precedence/);
  });
});

describe('buildSectionBundle', () => {
  it('needs a primary section', () => {
    expect(() => buildSectionBundle([], 300)).toThrow('A bundle needs its primary section');
  });
});
