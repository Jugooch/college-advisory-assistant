/**
 * @file Tests for decisive-leaf, credit-load, and as-of wording.
 */
import { describe, expect, it } from 'vitest';

import { createCheckEvidence, ReasonCode } from '@caa/domain';
import { SYNTHETIC_COURSES } from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';

import { describeAsOf, describeCreditLoad, describeLeaf } from './decisive-leaf-wording';

const MATH_101 = SYNTHETIC_COURSES.math101.id;
const COURSES = indexCourses([
  {
    courseId: MATH_101,
    code: 'DEMO-MATH 101',
    title: null,
    credits: { kind: 'FIXED', creditsHundredths: 300 },
  },
]);
const NO_COURSES = indexCourses();

/**
 * Builds the single decisive leaf of a parsed evidence object.
 *
 * @param leaf - The raw leaf.
 * @returns The parsed leaf.
 */
function parsedLeaf(
  leaf: Parameters<typeof createCheckEvidence>[0]['decisiveLeaves'][number],
): ReturnType<typeof createCheckEvidence>['decisiveLeaves'][number] {
  const [parsed] = createCheckEvidence({
    rulesetVersion: 'demo-2026.1',
    decisiveLeaves: [leaf],
  }).decisiveLeaves;
  if (parsed === undefined) {
    throw new Error('leaf missing');
  }
  return parsed;
}

describe('describeLeaf', () => {
  it('names the minimum letter grade and the course', () => {
    const leaf = parsedLeaf({
      type: 'COURSE',
      path: [],
      courseId: MATH_101,
      requiredGrade: { scheme: 'LETTER', value: 'C' },
      attemptIds: [],
      reasonCode: ReasonCode.InProgressMinGrade,
    });

    expect(describeLeaf(leaf, COURSES)).toBe(
      'Requires C or higher in DEMO-MATH 101 (title not available)',
    );
  });

  it('names the course by its ID, and says so, when it has no catalog entry', () => {
    const leaf = parsedLeaf({
      type: 'COURSE',
      path: [],
      courseId: MATH_101,
      requiredGrade: { scheme: 'LETTER', value: 'C' },
      attemptIds: [],
      reasonCode: null,
    });

    expect(describeLeaf(leaf, NO_COURSES)).toBe(
      `Requires C or higher in course ${MATH_101} (no catalog details available)`,
    );
  });

  it('asks for a passing grade when the leaf has no minimum', () => {
    const leaf = parsedLeaf({
      type: 'COURSE',
      path: [0],
      courseId: MATH_101,
      requiredGrade: null,
      attemptIds: [],
      reasonCode: null,
    });

    expect(describeLeaf(leaf, COURSES)).toBe(
      'Requires a passing grade in DEMO-MATH 101 (title not available)',
    );
  });

  it('quotes rule text the planner cannot interpret', () => {
    const leaf = parsedLeaf({
      type: 'UNSUPPORTED',
      path: [1],
      sourceText: 'Consent of the synthetic department',
      reasonCode: ReasonCode.UnsupportedRule,
    });

    expect(describeLeaf(leaf, COURSES)).toBe(
      'Rule text the planner can’t interpret: “Consent of the synthetic department”',
    );
  });
});

describe('describeCreditLoad', () => {
  it('states the total and the term bounds in credits', () => {
    expect(
      describeCreditLoad({
        totalCreditsHundredths: 1450,
        minCreditsHundredths: 1200,
        maxCreditsHundredths: 1800,
      }),
    ).toBe('Total 14.5 credits; this term’s load is 12 to 18 credits.');
  });
});

describe('describeAsOf', () => {
  it('names both the record time and the audit record time', () => {
    expect(
      describeAsOf({
        studentRecordEffectiveAt: '2026-09-12T14:00:00Z',
        auditRecordEffectiveAt: '2026-09-10T09:00:00Z',
      }),
    ).toBe('Sep 12, 2026, 2:00 PM UTC (record) and Sep 10, 2026, 9:00 AM UTC (audit)');
  });
});
