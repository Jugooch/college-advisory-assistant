/**
 * @file Table definition for catalog courses.
 * @module @caa/db/tables/course
 * @requirement FR-06
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { equivalencyGroupTable } from './equivalency-group.table';
import { institutionTable } from './institution.table';

/**
 * The `course` table. One row per source course per tenant. Credits are hundredths of a credit
 * (350 = 3.5 credits), in exactly one form: fixed, or a variable min/max range.
 */
export const courseTable = pgTable(
  'course',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    sourceCourseId: text('source_course_id').notNull(),
    /** Display text such as `MATH 101`. Never used as identity. */
    label: text('label').notNull(),
    /** Catalog title such as `Calculus I`, or null when the catalog supplies none. */
    title: text('title'),
    /** Fixed credits in hundredths, or null for a variable-credit course. */
    creditsHundredths: integer('credits_hundredths'),
    /** Variable-credit lower bound in hundredths, or null for a fixed-credit course. */
    minCreditsHundredths: integer('min_credits_hundredths'),
    /** Variable-credit upper bound in hundredths, or null for a fixed-credit course. */
    maxCreditsHundredths: integer('max_credits_hundredths'),
    /** Equivalency group, or null when the course has no equivalents. */
    equivalencyGroupId: uuid('equivalency_group_id'),
    /**
     * Linked course whose credit total already includes this one's, such as a lab counted in
     * its lecture. Null means the course counts its own credits. Sourced from the catalog.
     */
    creditsIncludedInCourseId: uuid('credits_included_in_course_id'),
    /** True when the institution states the course is repeatable for credit. False states nothing. */
    repeatableForCredit: boolean('repeatable_for_credit').notNull().default(false),
    /** Most attempts that may earn credit, or null when no cap is stated. */
    repeatMaxAttempts: integer('repeat_max_attempts'),
    /** Most credits all attempts may earn together, in hundredths, or null when uncapped. */
    repeatMaxCreditsHundredths: integer('repeat_max_credits_hundredths'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('course_tenant_id_source_course_id_key').on(table.tenantId, table.sourceCourseId),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('course_tenant_id_id_key').on(table.tenantId, table.id),
    // SECURITY: a course can only join an equivalency group of its own tenant.
    foreignKey({
      name: 'course_equivalency_group_fk',
      columns: [table.tenantId, table.equivalencyGroupId],
      foreignColumns: [equivalencyGroupTable.tenantId, equivalencyGroupTable.id],
    }),
    // SECURITY: credits can only be included in a course of the same tenant.
    foreignKey({
      name: 'course_credits_included_in_course_fk',
      columns: [table.tenantId, table.creditsIncludedInCourseId],
      foreignColumns: [table.tenantId, table.id],
    }),
    // SAFETY: mirrors `CourseSchema`: a course included in itself would drop its own credits.
    check(
      'course_credits_not_included_in_itself',
      sql`${table.creditsIncludedInCourseId} IS NULL OR ${table.creditsIncludedInCourseId} <> ${table.id}`,
    ),
    // SAFETY: mirrors `RepeatableForCreditSchema`: caps exist only on a repeatable course.
    check(
      'course_repeat_caps_need_flag',
      sql`${table.repeatableForCredit} OR (${table.repeatMaxAttempts} IS NULL AND ${table.repeatMaxCreditsHundredths} IS NULL)`,
    ),
    check(
      'course_repeat_max_attempts_min',
      sql`${table.repeatMaxAttempts} IS NULL OR ${table.repeatMaxAttempts} >= 2`,
    ),
    check(
      'course_repeat_max_credits_positive',
      sql`${table.repeatMaxCreditsHundredths} IS NULL OR ${table.repeatMaxCreditsHundredths} > 0`,
    ),
    check('course_source_course_id_not_empty', sql`length(${table.sourceCourseId}) > 0`),
    // SAFETY: unknown is an explicit null, never an empty title.
    check('course_title_not_empty', sql`${table.title} IS NULL OR length(${table.title}) > 0`),
    check('course_label_not_empty', sql`length(${table.label}) > 0`),
    // SAFETY: credit totals drive load and progress checks, so a stored course states its
    // credits in exactly one form, mirroring `CourseSchema`.
    check(
      'course_credit_form',
      sql`(${table.creditsHundredths} IS NOT NULL AND ${table.minCreditsHundredths} IS NULL AND ${table.maxCreditsHundredths} IS NULL)
        OR (${table.creditsHundredths} IS NULL AND ${table.minCreditsHundredths} IS NOT NULL AND ${table.maxCreditsHundredths} IS NOT NULL)`,
    ),
    check(
      'course_credits_nonnegative',
      sql`coalesce(${table.creditsHundredths}, 0) >= 0
        AND coalesce(${table.minCreditsHundredths}, 0) >= 0
        AND coalesce(${table.maxCreditsHundredths}, 0) >= 0`,
    ),
    check(
      'course_credit_range',
      sql`${table.minCreditsHundredths} IS NULL OR ${table.maxCreditsHundredths} IS NULL
        OR ${table.minCreditsHundredths} <= ${table.maxCreditsHundredths}`,
    ),
  ],
);

/** A row read from {@link courseTable}. Never leaves this package. */
export type CourseRow = typeof courseTable.$inferSelect;
