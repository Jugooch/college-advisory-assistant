/**
 * @file Tests for the prerequisite rule row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { PrerequisiteRuleRow } from '../tables/prerequisite-rule.table';
import { toPrerequisiteRule } from './prerequisite-rule.mapper';

const MATH_101 = '3c4d5e6f-7081-4a92-8b3c-4d5e6f708192';
const MATH_099 = '5e6f7081-92a3-4b4c-8d5e-6f708192a3b4';

const ROW: PrerequisiteRuleRow = {
  id: '6f708192-a3b4-4c5d-9e6f-708192a3b4c5',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  courseId: '708192a3-b4c5-4d6e-8f70-8192a3b4c5d6',
  rulesetVersion: 'demo-2026.1',
  expression: {
    type: 'ANY',
    items: [
      { type: 'COURSE', courseId: MATH_101, minimumGrade: { scheme: 'LETTER', value: 'C' } },
      { type: 'COURSE', courseId: MATH_099, minimumGrade: null },
    ],
  },
  sourceRef: 'demo-rule-0001',
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

describe('toPrerequisiteRule', () => {
  it('parses the stored expression tree into the domain rule', () => {
    const rule = toPrerequisiteRule(ROW);

    expect(rule).toEqual({
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      courseId: '708192a3-b4c5-4d6e-8f70-8192a3b4c5d6',
      expression: ROW.expression,
      sourceRef: 'demo-rule-0001',
      rulesetVersion: 'demo-2026.1',
    });
  });

  it('rejects a stored expression with an empty ALL group', () => {
    expect(() => toPrerequisiteRule({ ...ROW, expression: { type: 'ALL', items: [] } })).toThrow(
      ZodError,
    );
  });

  it('rejects a stored expression with an unknown node type', () => {
    expect(() =>
      toPrerequisiteRule({ ...ROW, expression: { type: 'SOMETIMES', items: [] } }),
    ).toThrow(ZodError);
  });

  it('rejects an invalid grade deep inside the tree', () => {
    const expression = {
      type: 'ALL',
      items: [
        { type: 'COURSE', courseId: MATH_101, minimumGrade: { scheme: 'LETTER', value: 'P' } },
      ],
    };

    expect(() => toPrerequisiteRule({ ...ROW, expression })).toThrow(ZodError);
  });
});
