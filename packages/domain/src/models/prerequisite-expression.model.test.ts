/**
 * @file Tests for the prerequisite expression tree.
 */
import { describe, expect, it } from 'vitest';

import { GradeScheme } from '../enums/grade-scheme.enum';
import { PrerequisiteExpressionType } from '../enums/prerequisite-expression-type.enum';
import { ReasonCode } from '../enums/reason-code.enum';
import {
  createPrerequisiteExpression,
  type PrerequisiteExpressionInput,
  PrerequisiteExpressionSchema,
} from './prerequisite-expression.model';

const CALC_1 = '3c4d5e6f-0000-4000-8000-000000000001';
const PRECALC = '3c4d5e6f-0000-4000-8000-000000000002';
const PLACEMENT_COURSE = '3c4d5e6f-0000-4000-8000-000000000003';

const MIN_C: PrerequisiteExpressionInput = {
  type: PrerequisiteExpressionType.Course,
  courseId: CALC_1,
  minimumGrade: { scheme: GradeScheme.Letter, value: 'C' },
};

const NESTED: PrerequisiteExpressionInput = {
  type: PrerequisiteExpressionType.All,
  items: [
    MIN_C,
    {
      type: PrerequisiteExpressionType.Any,
      items: [
        { type: PrerequisiteExpressionType.Course, courseId: PRECALC, minimumGrade: null },
        { type: PrerequisiteExpressionType.Course, courseId: PLACEMENT_COURSE, minimumGrade: null },
        {
          type: PrerequisiteExpressionType.Unsupported,
          sourceText: 'or consent of the department',
          reasonCode: ReasonCode.UnsupportedRule,
        },
      ],
    },
  ],
};

describe('createPrerequisiteExpression', () => {
  it('accepts a single course with a minimum grade', () => {
    expect(createPrerequisiteExpression(MIN_C)).toEqual({
      type: 'COURSE',
      courseId: '3c4d5e6f-0000-4000-8000-000000000001',
      minimumGrade: { scheme: 'LETTER', value: 'C' },
    });
  });

  it('round-trips a nested ALL/ANY expression unchanged', () => {
    expect(createPrerequisiteExpression(NESTED)).toEqual({
      type: 'ALL',
      items: [
        {
          type: 'COURSE',
          courseId: '3c4d5e6f-0000-4000-8000-000000000001',
          minimumGrade: { scheme: 'LETTER', value: 'C' },
        },
        {
          type: 'ANY',
          items: [
            {
              type: 'COURSE',
              courseId: '3c4d5e6f-0000-4000-8000-000000000002',
              minimumGrade: null,
            },
            {
              type: 'COURSE',
              courseId: '3c4d5e6f-0000-4000-8000-000000000003',
              minimumGrade: null,
            },
            {
              type: 'UNSUPPORTED',
              sourceText: 'or consent of the department',
              reasonCode: 'UNSUPPORTED_RULE',
            },
          ],
        },
      ],
    });
  });

  it('keeps ANY alternatives in source order without implying all are required', () => {
    const expression = createPrerequisiteExpression({
      type: PrerequisiteExpressionType.Any,
      items: [
        MIN_C,
        { type: PrerequisiteExpressionType.Course, courseId: PRECALC, minimumGrade: null },
      ],
    });

    expect(expression.type).toBe('ANY');
  });

  it('rejects an empty ALL', () => {
    expect(() =>
      createPrerequisiteExpression({ type: PrerequisiteExpressionType.All, items: [] }),
    ).toThrow();
  });

  it('rejects an empty ANY', () => {
    expect(() =>
      createPrerequisiteExpression({ type: PrerequisiteExpressionType.Any, items: [] }),
    ).toThrow();
  });

  it('rejects an empty group nested deep inside the tree', () => {
    expect(() =>
      createPrerequisiteExpression({
        type: PrerequisiteExpressionType.All,
        items: [MIN_C, { type: PrerequisiteExpressionType.Any, items: [] }],
      }),
    ).toThrow();
  });

  it('rejects a course node whose courseId is not a UUID', () => {
    expect(() => createPrerequisiteExpression({ ...MIN_C, courseId: 'MATH 101' })).toThrow();
  });

  it('accepts a pass/fail minimum grade', () => {
    const expression = createPrerequisiteExpression({
      type: PrerequisiteExpressionType.Course,
      courseId: CALC_1,
      minimumGrade: { scheme: GradeScheme.PassFail, value: 'P' },
    });

    expect(expression).toEqual({
      type: 'COURSE',
      courseId: '3c4d5e6f-0000-4000-8000-000000000001',
      minimumGrade: { scheme: 'PASS_FAIL', value: 'P' },
    });
  });

  it('rejects P as a letter minimum grade', () => {
    const result = PrerequisiteExpressionSchema.safeParse({
      type: 'COURSE',
      courseId: CALC_1,
      minimumGrade: { scheme: 'LETTER', value: 'P' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unsupported node with empty source text', () => {
    expect(() =>
      createPrerequisiteExpression({
        type: PrerequisiteExpressionType.Unsupported,
        sourceText: '',
        reasonCode: ReasonCode.UnsupportedRule,
      }),
    ).toThrow();
  });
});

describe('PrerequisiteExpressionSchema', () => {
  it('rejects an unknown node type such as NOT', () => {
    expect(PrerequisiteExpressionSchema.safeParse({ type: 'NOT', items: [MIN_C] }).success).toBe(
      false,
    );
  });

  it('rejects an unsupported node whose reason code is not registered', () => {
    const result = PrerequisiteExpressionSchema.safeParse({
      type: 'UNSUPPORTED',
      sourceText: 'instructor permission',
      reasonCode: 'NEEDS_PERMISSION',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a course node with an omitted minimumGrade, because unknown must be explicit', () => {
    expect(
      PrerequisiteExpressionSchema.safeParse({ type: 'COURSE', courseId: CALC_1 }).success,
    ).toBe(false);
  });
});
