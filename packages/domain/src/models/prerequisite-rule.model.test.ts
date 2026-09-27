/**
 * @file Tests for the prerequisite rule data object.
 */
import { describe, expect, it } from 'vitest';

import { PrerequisiteExpressionType } from '../enums/prerequisite-expression-type.enum';
import { createPrerequisiteRule, type PrerequisiteRuleInput } from './prerequisite-rule.model';

const VALID: PrerequisiteRuleInput = {
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  courseId: '3c4d5e6f-0000-4000-8000-000000000010',
  expression: {
    type: PrerequisiteExpressionType.Course,
    courseId: '3c4d5e6f-0000-4000-8000-000000000001',
    minimumGrade: null,
  },
  sourceRef: 'rule_demo_calc1_to_calc2',
  rulesetVersion: 'demo-2026.1',
};

describe('createPrerequisiteRule', () => {
  it('accepts a rule with a single-course expression', () => {
    expect(createPrerequisiteRule(VALID)).toEqual({
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      courseId: '3c4d5e6f-0000-4000-8000-000000000010',
      expression: {
        type: 'COURSE',
        courseId: '3c4d5e6f-0000-4000-8000-000000000001',
        minimumGrade: null,
      },
      sourceRef: 'rule_demo_calc1_to_calc2',
      rulesetVersion: 'demo-2026.1',
    });
  });

  it('rejects a rule whose expression contains an empty group', () => {
    expect(() =>
      createPrerequisiteRule({
        ...VALID,
        expression: { type: PrerequisiteExpressionType.All, items: [] },
      }),
    ).toThrow();
  });

  it('rejects an empty sourceRef', () => {
    expect(() => createPrerequisiteRule({ ...VALID, sourceRef: '' })).toThrow();
  });

  it('rejects an empty rulesetVersion', () => {
    expect(() => createPrerequisiteRule({ ...VALID, rulesetVersion: '' })).toThrow();
  });

  it('rejects a tenantId that is not a UUID', () => {
    expect(() => createPrerequisiteRule({ ...VALID, tenantId: 'demo-state' })).toThrow();
  });
});
