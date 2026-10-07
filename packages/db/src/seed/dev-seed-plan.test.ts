/**
 * @file Unit tests for the shape of the synthetic dev seed plan.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  IdentityStatus,
  InstitutionIdSchema,
  PrerequisiteExpressionType,
  Role,
  UserIdentitySchema,
} from '@caa/domain';

import { SEED_CATALOG, SEED_RULESET_VERSION } from './dev-seed-academic-catalog';
import { buildDevSeedPlan, DEV_SEED_ISSUER } from './dev-seed-plan';

const DEV_SEED_PLAN = buildDevSeedPlan(new Date('2026-10-01T12:00:00.000Z'));

const EnvExampleTokensSchema = z.record(
  z.string(),
  z.object({ issuer: z.string(), subject: z.string() }),
);

function readExampleDevTokens(): z.infer<typeof EnvExampleTokensSchema> {
  const envExample = readFileSync(
    new URL('../../../../infra/env.example', import.meta.url),
    'utf8',
  );
  const line = envExample.split('\n').find((entry) => entry.startsWith('DEV_AUTH_TOKENS='));
  const json = line?.slice('DEV_AUTH_TOKENS='.length).replace(/^'|'$/g, '') ?? '{}';
  return EnvExampleTokensSchema.parse(JSON.parse(json));
}

describe('buildDevSeedPlan', () => {
  it('seeds the two synthetic institutions', () => {
    const names = DEV_SEED_PLAN.institutions.map((institution) => institution.name);

    expect(names).toEqual(['Demo State University', 'Sample Community College']);
  });

  it('seeds one active student, advisor, and admin identity, each a valid identity', () => {
    const identities = DEV_SEED_PLAN.identities.map((identity) =>
      UserIdentitySchema.parse(identity),
    );

    expect(identities.map((identity) => identity.roles)).toEqual([
      [Role.Student],
      [Role.Advisor],
      [Role.Admin],
    ]);
    expect(identities.every((identity) => identity.status === IdentityStatus.Active)).toBe(true);
  });

  it('has an identity for every example dev token in infra/env.example', () => {
    const tokens = Object.values(readExampleDevTokens());

    const seeded = tokens.map((token) =>
      DEV_SEED_PLAN.identities.some(
        (identity) => identity.issuer === token.issuer && identity.subject === token.subject,
      ),
    );

    expect(tokens.length).toBeGreaterThan(0);
    expect(seeded.every(Boolean)).toBe(true);
  });

  it('links the student identity to exactly one student in its own tenant', () => {
    const student = DEV_SEED_PLAN.identities.find((identity) =>
      identity.roles.includes(Role.Student),
    );

    const linked = DEV_SEED_PLAN.students.filter((row) => row.userSubject === student?.subject);

    expect(linked).toHaveLength(1);
    expect(linked[0]?.tenantId).toBe(student?.tenantId);
  });

  it('assigns the advisor to the linked and the stale-audit students, open-ended', () => {
    const assigned = (sourceStudentId: string): unknown =>
      expect.objectContaining({
        advisorSubject: 'synthetic-advisor-001',
        sourceStudentId,
        approverSubject: 'synthetic-admin-001',
        effectiveTo: null,
      });

    expect(DEV_SEED_PLAN.assignments).toEqual([assigned('SYN-000001'), assigned('SYN-000002')]);
  });

  it('keeps every academic student in the seeded students', () => {
    const planStudentIds = new Set(DEV_SEED_PLAN.students.map((student) => student.id));

    const academicStudentIds = [
      ...DEV_SEED_PLAN.academic.attempts,
      ...DEV_SEED_PLAN.academic.snapshots,
      ...DEV_SEED_PLAN.academic.audits,
    ].map((record) => record.studentId);

    expect(academicStudentIds.every((studentId) => planStudentIds.has(studentId))).toBe(true);
  });

  it('keeps every record inside a seeded tenant and uses only the synthetic issuer', () => {
    const tenantIds = new Set(DEV_SEED_PLAN.institutions.map((institution) => institution.id));

    const records = [
      ...DEV_SEED_PLAN.identities,
      ...DEV_SEED_PLAN.students,
      ...DEV_SEED_PLAN.assignments,
    ];

    expect(records.every((record) => tenantIds.has(record.tenantId))).toBe(true);
    expect(DEV_SEED_PLAN.identities.every((identity) => identity.issuer === DEV_SEED_ISSUER)).toBe(
      true,
    );
    expect([...tenantIds].every((id) => InstitutionIdSchema.safeParse(id).success)).toBe(true);
  });

  describe('prerequisite rules', () => {
    const { rules, courses } = DEV_SEED_PLAN.academic;

    it('gives every seeded course exactly one rule in the seeded ruleset', () => {
      const inRuleset = rules.filter((rule) => rule.rulesetVersion === SEED_RULESET_VERSION);

      expect(inRuleset.map((rule) => rule.courseId).sort()).toEqual(
        courses.map((course) => course.id).sort(),
      );
    });

    it('states NONE for DEMO-ENGL 101 and every linked lab', () => {
      const ruleFor = (courseId: string) => rules.find((rule) => rule.courseId === courseId);

      expect(ruleFor(SEED_CATALOG.engl101.id)?.expression).toEqual({
        type: PrerequisiteExpressionType.None,
      });
      expect(ruleFor(SEED_CATALOG.phys301Lab.id)?.expression.type).toBe(
        PrerequisiteExpressionType.None,
      );
      expect(ruleFor(SEED_CATALOG.engl101.id)?.sourceRef).toBe('demo-catalog-rule:DEMO-ENGL-101');
    });

    it('keeps the real rules and never states NONE for a course with a prerequisite', () => {
      const real = [SEED_CATALOG.math102, SEED_CATALOG.phys201, SEED_CATALOG.phys301];

      for (const course of real) {
        const rule = rules.find((entry) => entry.courseId === course.id);
        expect(rule?.expression.type).not.toBe(PrerequisiteExpressionType.None);
      }
      expect(rules.filter((rule) => rule.expression.type !== 'NONE')).toHaveLength(real.length);
    });
  });
});
