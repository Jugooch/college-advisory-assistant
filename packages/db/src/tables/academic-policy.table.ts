/**
 * @file Table definition for academic policy, one row per tenant and ruleset version.
 * @module @caa/db/tables/academic-policy
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import type { LetterGrade, RepeatPolicy } from '@caa/domain';

import { institutionTable } from './institution.table';

/**
 * The `academic_policy` table. Published policy is immutable: a change is a new
 * `ruleset_version`. Every nullable column means "the institution hasn't said", never a default.
 * The database enforces immutability: migration `0003_immutable_published_rules` rejects UPDATE,
 * DELETE and TRUNCATE (NFR-01).
 */
export const academicPolicyTable = pgTable(
  'academic_policy',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    rulesetVersion: text('ruleset_version').notNull(),
    allowsInProgressPrerequisites: boolean('allows_in_progress_prerequisites').notNull(),
    /** Whether a `P` meets a letter minimum, or null when the institution hasn't said. */
    passSatisfiesMinimumGrade: boolean('pass_satisfies_minimum_grade'),
    /** Letter grades, highest first; the mapper re-validates them. */
    letterGradeOrder: text('letter_grade_order').array().notNull().$type<LetterGrade[]>(),
    lowestPassingLetterGrade: text('lowest_passing_letter_grade').$type<LetterGrade>(),
    repeatPolicy: text('repeat_policy').$type<RepeatPolicy>(),
    /** Term credit-load minimum in hundredths; null together with the maximum when unknown. */
    termMinCreditsHundredths: integer('term_min_credits_hundredths'),
    /** Term credit-load maximum in hundredths; null together with the minimum when unknown. */
    termMaxCreditsHundredths: integer('term_max_credits_hundredths'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('academic_policy_tenant_id_ruleset_version_key').on(
      table.tenantId,
      table.rulesetVersion,
    ),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('academic_policy_tenant_id_id_key').on(table.tenantId, table.id),
    check('academic_policy_ruleset_version_not_empty', sql`length(${table.rulesetVersion}) > 0`),
    check(
      'academic_policy_letter_grade_order_not_empty',
      sql`cardinality(${table.letterGradeOrder}) > 0`,
    ),
    // SAFETY: half a range is not a range. Unknown bounds are both null, so the engine returns
    // CREDIT_BOUNDS_UNDEFINED instead of applying one side.
    check(
      'academic_policy_term_credit_bounds_both_or_neither',
      sql`(${table.termMinCreditsHundredths} IS NULL) = (${table.termMaxCreditsHundredths} IS NULL)`,
    ),
    // SAFETY: a minimum above the maximum would fail every credit load.
    check(
      'academic_policy_term_credit_bounds_range',
      sql`${table.termMinCreditsHundredths} IS NULL
        OR (${table.termMinCreditsHundredths} >= 0
          AND ${table.termMinCreditsHundredths} <= ${table.termMaxCreditsHundredths})`,
    ),
  ],
);

/** A row read from {@link academicPolicyTable}. Never leaves this package. */
export type AcademicPolicyRow = typeof academicPolicyTable.$inferSelect;
