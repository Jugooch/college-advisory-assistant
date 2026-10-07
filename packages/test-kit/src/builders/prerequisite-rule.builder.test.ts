/**
 * @file Tests for the synthetic prerequisite rule builder and its expression helpers.
 */
import { describe, expect, it } from 'vitest';

import { PrerequisiteExpressionSchema, PrerequisiteRuleSchema, ReasonCode } from '@caa/domain';

import { letter, pass } from './grade.builder';
import {
  all,
  any,
  buildPrerequisiteRule,
  course,
  none,
  unsupported,
} from './prerequisite-rule.builder';

const MATH101 = '50000000-0000-4000-8000-000000000101';
const MATH111 = '50000000-0000-4000-8000-000000000111';
const PHYS201 = '50000000-0000-4000-8000-000000000201';

describe('buildPrerequisiteRule', () => {
  it('defaults to DEMO-MATH 102 requiring DEMO-MATH 101 with at least a C', () => {
    expect(buildPrerequisiteRule()).toEqual({
      tenantId: '10000000-0000-4000-8000-000000000001',
      courseId: '50000000-0000-4000-8000-000000000102',
      expression: {
        type: 'COURSE',
        courseId: MATH101,
        minimumGrade: { scheme: 'LETTER', value: 'C' },
      },
      sourceRef: 'demo-rule-0001',
      rulesetVersion: 'demo-2026.1',
    });
  });

  it('returns deep-equal rules for the same arguments', () => {
    expect(buildPrerequisiteRule({}, 7)).toEqual(buildPrerequisiteRule({}, 7));
  });

  it('derives the sourceRef from the seed', () => {
    expect(buildPrerequisiteRule({}, 42).sourceRef).toBe('demo-rule-0042');
  });

  it('applies overrides', () => {
    const rule = buildPrerequisiteRule({
      courseId: PHYS201,
      expression: any(course(MATH101), course(MATH111)),
      rulesetVersion: 'demo-2025.2',
    });

    expect(rule.courseId).toBe(PHYS201);
    expect(rule.expression.type).toBe('ANY');
    expect(rule.rulesetVersion).toBe('demo-2025.2');
  });

  it('returns a rule that passes the domain schema', () => {
    expect(PrerequisiteRuleSchema.safeParse(buildPrerequisiteRule()).success).toBe(true);
  });

  it('rejects an empty source reference', () => {
    expect(() => buildPrerequisiteRule({ sourceRef: '' })).toThrow();
  });
});

describe('expression helpers', () => {
  it('builds a course node with no minimum grade by default', () => {
    expect(course(MATH101)).toEqual({ type: 'COURSE', courseId: MATH101, minimumGrade: null });
  });

  it('builds a course node with the given minimum grade', () => {
    expect(course(MATH101, pass())).toEqual({
      type: 'COURSE',
      courseId: MATH101,
      minimumGrade: { scheme: 'PASS_FAIL', value: 'P' },
    });
  });

  it('nests all and any nodes in the order given', () => {
    const expression = all(any(course(MATH101, letter('C')), course(MATH111)), course(PHYS201));

    expect(expression).toEqual({
      type: 'ALL',
      items: [
        {
          type: 'ANY',
          items: [
            { type: 'COURSE', courseId: MATH101, minimumGrade: { scheme: 'LETTER', value: 'C' } },
            { type: 'COURSE', courseId: MATH111, minimumGrade: null },
          ],
        },
        { type: 'COURSE', courseId: PHYS201, minimumGrade: null },
      ],
    });
    expect(PrerequisiteExpressionSchema.safeParse(expression).success).toBe(true);
  });

  it('builds an unsupported node with UNSUPPORTED_RULE by default', () => {
    expect(unsupported('Instructor consent or junior standing')).toEqual({
      type: 'UNSUPPORTED',
      sourceText: 'Instructor consent or junior standing',
      reasonCode: 'UNSUPPORTED_RULE',
    });
  });

  it('builds an unsupported node with the given reason code', () => {
    expect(unsupported('See department', ReasonCode.AuditAmbiguous)).toEqual({
      type: 'UNSUPPORTED',
      sourceText: 'See department',
      reasonCode: 'AUDIT_AMBIGUOUS',
    });
  });

  it('builds the explicit no-prerequisite root', () => {
    expect(none()).toEqual({ type: 'NONE' });
  });

  it('builds a rule with a NONE expression that passes the domain schema', () => {
    const rule = buildPrerequisiteRule({ expression: none() });

    expect(rule.expression).toEqual({ type: 'NONE' });
    expect(PrerequisiteRuleSchema.safeParse(rule).success).toBe(true);
  });

  it('rejects NONE inside a group', () => {
    expect(() => all({ type: 'NONE' } as never)).toThrow();
  });

  it('rejects an empty group', () => {
    expect(() => all()).toThrow();
    expect(() => any()).toThrow();
  });

  it('rejects a course ID that is not a UUID', () => {
    expect(() => course('DEMO-MATH-101')).toThrow();
  });
});
