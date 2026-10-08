/**
 * @file The synthetic records the local dev seed writes. Data, plus a builder that adds one run's
 *   academic records; `seed-dev-data.ts` writes the plan.
 * @module @caa/db/seed/dev-seed-plan
 * @requirement FR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { IdentityStatus, type PolicyDocument, Role } from '@caa/domain';

import { buildDevSeedAcademicPlan, type DevSeedAcademicPlan } from './dev-seed-academic-plan';
import { SEED_POLICY_DOCUMENTS } from './dev-seed-policy-plan';
import { buildDevSeedSectionPlan, type DevSeedSectionPlan } from './dev-seed-section-plan';

/** A synthetic institution (tenant). Upserted by `id`. */
export interface SeedInstitution {
  readonly id: string;
  readonly name: string;
  /** IANA time zone name. */
  readonly timezone: string;
}

/** A synthetic SSO identity. Upserted by `issuer` + `subject`. */
export interface SeedIdentity {
  /** ID used when the identity is first inserted; an existing row keeps its own ID. */
  readonly id: string;
  readonly tenantId: string;
  readonly issuer: string;
  readonly subject: string;
  readonly roles: readonly Role[];
  readonly status: IdentityStatus;
}

/** A synthetic student. Upserted by `tenantId` + `sourceStudentId`. */
export interface SeedStudent {
  /** ID used when the student is first inserted; an existing row keeps its own ID. */
  readonly id: string;
  readonly tenantId: string;
  readonly sourceStudentId: string;
  /** Subject of the linked identity in the same tenant, or null when no one signs in as it. */
  readonly userSubject: string | null;
  /** ISO 8601 with offset. */
  readonly sourceEffectiveAt: string;
}

/** A synthetic advisor assignment. Upserted by `id`, since the table has no natural key. */
export interface SeedAssignment {
  readonly id: string;
  readonly tenantId: string;
  readonly advisorSubject: string;
  readonly sourceStudentId: string;
  readonly approverSubject: string;
  /** ISO 8601 with offset, inclusive. */
  readonly effectiveFrom: string;
  /** ISO 8601 with offset, exclusive, or null when open-ended. */
  readonly effectiveTo: string | null;
}

/** Everything the dev seed writes, in dependency order. */
export interface DevSeedPlan {
  readonly institutions: readonly SeedInstitution[];
  readonly identities: readonly SeedIdentity[];
  readonly students: readonly SeedStudent[];
  readonly assignments: readonly SeedAssignment[];
  /** Catalog, rules, policy, terms, snapshots, and audits; written after the students. */
  readonly academic: DevSeedAcademicPlan;
  /** Campuses, the transition table, and the 2027SP section snapshot; written last. */
  readonly sections: DevSeedSectionPlan;
  /** The approved policy corpus; written last. */
  readonly policyDocuments: readonly PolicyDocument[];
}

/** Issuer of every seeded identity; matches `DEV_AUTH_TOKENS` in `infra/env.example`. */
export const DEV_SEED_ISSUER = 'https://idp.synthetic.example';

/** Demo State University. Same ID as tenant `a` in `@caa/test-kit`. */
const TENANT_A = '10000000-0000-4000-8000-000000000001';
/** Sample Community College. Same ID as tenant `b` in `@caa/test-kit`. */
const TENANT_B = '10000000-0000-4000-8000-000000000002';
const SOURCE_EFFECTIVE_AT = '2026-08-15T00:00:00.000Z';

/**
 * The fixed, fully synthetic tenants, identities, students, and assignments. Every name and ID is
 * fictional; nothing here is real data. The advisor and student subjects match the example
 * `DEV_AUTH_TOKENS`.
 */
const DEV_SEED_ACCESS_PLAN: Omit<DevSeedPlan, 'academic' | 'sections' | 'policyDocuments'> = {
  institutions: [
    { id: TENANT_A, name: 'Demo State University', timezone: 'America/Chicago' },
    { id: TENANT_B, name: 'Sample Community College', timezone: 'America/Denver' },
  ],
  identities: [
    {
      id: '20000000-0000-4000-8000-000000000001',
      tenantId: TENANT_A,
      issuer: DEV_SEED_ISSUER,
      subject: 'synthetic-student-001',
      roles: [Role.Student],
      status: IdentityStatus.Active,
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      tenantId: TENANT_A,
      issuer: DEV_SEED_ISSUER,
      subject: 'synthetic-advisor-001',
      roles: [Role.Advisor],
      status: IdentityStatus.Active,
    },
    {
      id: '20000000-0000-4000-8000-000000000003',
      tenantId: TENANT_A,
      issuer: DEV_SEED_ISSUER,
      subject: 'synthetic-admin-001',
      roles: [Role.Admin],
      status: IdentityStatus.Active,
    },
    // NOTE: assigned to no student, for the "unassigned advisor sees nothing" demo.
    {
      id: '20000000-0000-4000-8000-000000000004',
      tenantId: TENANT_A,
      issuer: DEV_SEED_ISSUER,
      subject: 'synthetic-advisor-002',
      roles: [Role.Advisor],
      status: IdentityStatus.Active,
    },
  ],
  students: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      tenantId: TENANT_A,
      sourceStudentId: 'SYN-000001',
      userSubject: 'synthetic-student-001',
      sourceEffectiveAt: SOURCE_EFFECTIVE_AT,
    },
    {
      id: '30000000-0000-4000-8000-000000000002',
      tenantId: TENANT_A,
      sourceStudentId: 'SYN-000002',
      userSubject: null,
      sourceEffectiveAt: SOURCE_EFFECTIVE_AT,
    },
    {
      id: '30000000-0000-4000-8000-000000000003',
      tenantId: TENANT_A,
      sourceStudentId: 'SYN-000003',
      userSubject: null,
      sourceEffectiveAt: SOURCE_EFFECTIVE_AT,
    },
    {
      id: '30000000-0000-4000-8000-000000000101',
      tenantId: TENANT_B,
      sourceStudentId: 'SYN-000101',
      userSubject: null,
      sourceEffectiveAt: SOURCE_EFFECTIVE_AT,
    },
  ],
  assignments: [
    {
      id: '40000000-0000-4000-8000-000000000001',
      tenantId: TENANT_A,
      advisorSubject: 'synthetic-advisor-001',
      sourceStudentId: 'SYN-000001',
      approverSubject: 'synthetic-admin-001',
      effectiveFrom: '2026-08-15T00:00:00.000Z',
      effectiveTo: null,
    },
    // NOTE: lets the advisor open SYN-000002, whose audit is deliberately stale (UNKNOWN).
    {
      id: '40000000-0000-4000-8000-000000000002',
      tenantId: TENANT_A,
      advisorSubject: 'synthetic-advisor-001',
      sourceStudentId: 'SYN-000002',
      approverSubject: 'synthetic-admin-001',
      effectiveFrom: '2026-08-15T00:00:00.000Z',
      effectiveTo: null,
    },
  ],
};

/**
 * Builds the full dev seed plan for one seed run.
 *
 * @param now - The time the seed run started, read once by the caller; every seeded record and
 *   audit time is derived from it.
 * @returns The plan. The same `now` always gives the same plan.
 * @throws {RangeError} When `now` is invalid.
 */
export function buildDevSeedPlan(now: Date): DevSeedPlan {
  return {
    ...DEV_SEED_ACCESS_PLAN,
    academic: buildDevSeedAcademicPlan(now),
    sections: buildDevSeedSectionPlan(now),
    policyDocuments: SEED_POLICY_DOCUMENTS,
  };
}
