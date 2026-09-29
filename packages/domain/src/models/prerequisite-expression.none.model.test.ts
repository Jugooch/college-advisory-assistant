/**
 * @file Tests for the explicit "no prerequisite" root expression.
 */
import { describe, expect, it } from 'vitest';

import {
  createPrerequisiteExpression,
  createPrerequisiteRootExpression,
  PrerequisiteExpressionSchema,
  PrerequisiteRootExpressionSchema,
} from './prerequisite-expression.model';

const CALC_1 = '3c4d5e6f-0000-4000-8000-000000000001';
const COURSE = { type: 'COURSE', courseId: CALC_1, minimumGrade: null } as const;

describe('createPrerequisiteRootExpression', () => {
  it('accepts NONE, meaning the institution states there is no prerequisite', () => {
    expect(createPrerequisiteRootExpression({ type: 'NONE' })).toEqual({ type: 'NONE' });
  });

  it('accepts an ordinary expression tree at the root', () => {
    const tree = { type: 'ALL', items: [COURSE] } as const;

    expect(createPrerequisiteRootExpression(tree)).toEqual({ type: 'ALL', items: [COURSE] });
  });

  it('rejects NONE with extra fields, so it can never carry course requirements', () => {
    expect(
      PrerequisiteRootExpressionSchema.safeParse({ type: 'NONE', items: [COURSE] }).success,
    ).toBe(false);
  });
});

describe('NONE below the root', () => {
  it.each(['ALL', 'ANY'])('rejects NONE inside %s', (type) => {
    const withNone = { type, items: [COURSE, { type: 'NONE' }] };

    expect(PrerequisiteRootExpressionSchema.safeParse(withNone).success).toBe(false);
  });

  it('rejects NONE nested two levels down', () => {
    const deep = { type: 'ALL', items: [{ type: 'ANY', items: [COURSE, { type: 'NONE' }] }] };

    expect(PrerequisiteRootExpressionSchema.safeParse(deep).success).toBe(false);
  });

  it('rejects NONE as a child expression, whose schema has no NONE node', () => {
    expect(PrerequisiteExpressionSchema.safeParse({ type: 'NONE' }).success).toBe(false);
    expect(() => createPrerequisiteExpression(COURSE)).not.toThrow();
  });
});
