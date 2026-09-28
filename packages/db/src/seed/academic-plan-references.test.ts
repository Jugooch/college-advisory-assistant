/**
 * @file Unit tests for the academic seed plan's reference checks.
 */
import { describe, expect, it } from 'vitest';

import {
  createCourseAttempt,
  createPrerequisiteExpression,
  createPrerequisiteRule,
  PrerequisiteExpressionType,
} from '@caa/domain';

import {
  AcademicSeedReferenceError,
  assertAcademicPlanReferences,
} from './academic-plan-references';
import { DEV_SEED_ACADEMIC_PLAN as PLAN, type DevSeedAcademicPlan } from './dev-seed-academic-plan';

/** A course ID that the seeded catalog doesn't contain. */
const UNCATALOGUED = '50000000-0000-4000-8000-00000000ffff';

/**
 * Returns the plan element at an index, failing the test when it is missing.
 *
 * @param items - Plan list.
 * @param index - Position.
 * @returns The element.
 */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`The seed plan has no element at ${String(index)}`);
  }
  return item;
}

/**
 * Checks a changed plan and returns the error message it fails with.
 *
 * @param changes - Plan fields to replace.
 * @returns The thrown message.
 */
function failureOf(changes: Partial<DevSeedAcademicPlan>): string {
  try {
    assertAcademicPlanReferences({ ...PLAN, ...changes });
  } catch (error) {
    expect(error).toBeInstanceOf(AcademicSeedReferenceError);
    return error instanceof Error ? error.message : '';
  }
  throw new Error('The plan was accepted');
}

describe('assertAcademicPlanReferences', () => {
  it('accepts the seeded plan', () => {
    expect(() => {
      assertAcademicPlanReferences(PLAN);
    }).not.toThrow();
  });

  it('refuses a rule whose nested expression names an uncatalogued course', () => {
    const base = at(PLAN.rules, 0);
    const rule = createPrerequisiteRule({
      ...base,
      expression: createPrerequisiteExpression({
        type: PrerequisiteExpressionType.Any,
        items: [
          base.expression,
          { type: PrerequisiteExpressionType.Course, courseId: UNCATALOGUED, minimumGrade: null },
        ],
      }),
    });

    expect(failureOf({ rules: [...PLAN.rules, rule] })).toContain('not in the catalog');
  });

  it('refuses an attempt in a term the calendar lacks', () => {
    const attempt = createCourseAttempt({ ...at(PLAN.attempts, 0), termCode: '2024FA' });

    expect(failureOf({ attempts: [attempt, ...PLAN.attempts.slice(1)] })).toContain(
      'not in the calendar',
    );
  });

  it("refuses a snapshot that lists another student's attempt", () => {
    const borrowed = { ...at(PLAN.snapshots, 1), attemptIds: [at(PLAN.attempts, 0).id] };
    const snapshots = [at(PLAN.snapshots, 0), borrowed, at(PLAN.snapshots, 2)];

    expect(failureOf({ snapshots })).toContain("not its student's");
  });

  it("refuses an audit pinned to another student's snapshot", () => {
    const audit = { ...at(PLAN.audits, 1), studentSnapshotId: at(PLAN.snapshots, 0).id };

    expect(failureOf({ audits: [at(PLAN.audits, 0), audit] })).toContain('not pinned');
  });

  it('refuses an audit allocating an attempt outside its pinned snapshot', () => {
    const stale = at(PLAN.audits, 1);
    const requirement = at(stale.requirements, 0);
    const audit = {
      ...stale,
      requirements: [{ ...requirement, allocatedAttemptIds: [at(PLAN.attempts, 3).id] }],
    };

    expect(failureOf({ audits: [at(PLAN.audits, 0), audit] })).toContain(
      'not in its pinned snapshot',
    );
  });
});
