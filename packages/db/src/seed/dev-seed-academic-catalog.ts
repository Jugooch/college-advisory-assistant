/**
 * @file The synthetic catalog, prerequisite rules, academic policy, and term calendar the dev
 *   seed writes. Data only; built with the domain factories, so an invalid record fails when
 *   this module loads.
 * @module @caa/db/seed/dev-seed-academic-catalog
 * @requirement FR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  type Course,
  createAcademicPolicy,
  createCourse,
  createPrerequisiteExpression,
  createPrerequisiteRule,
  createTermCalendar,
  GradeScheme,
  LetterGrade,
  type PrerequisiteExpression,
  PrerequisiteExpressionType,
  type PrerequisiteRule,
  RepeatPolicy,
  type TermInput,
} from '@caa/domain';

/** Demo State University; tenant `a` in `@caa/test-kit`. */
export const SEED_TENANT_ID = '10000000-0000-4000-8000-000000000001';
/** The one published ruleset version the seed writes. */
export const SEED_RULESET_VERSION = 'demo-2026.1';

/**
 * Builds a synthetic ID in the `@caa/test-kit` style: a kind prefix and a number.
 *
 * @param prefix - First UUID group, which names the record kind.
 * @param seed - Number that distinguishes records of one kind.
 * @returns A version-4-shaped UUID.
 */
export function seedId(prefix: string, seed: number): string {
  return `${prefix}-0000-4000-8000-${seed.toString(16).padStart(12, '0')}`;
}

/**
 * Builds a catalog course. The ID number matches `SYNTHETIC_COURSES` in `@caa/test-kit` where
 * the two overlap, and the source ID is the label with a hyphen, as there.
 *
 * @param seed - Number in the course ID.
 * @param label - Display label such as `DEMO-MATH 101`.
 * @param credits - Fixed credits in hundredths, or a variable `[min, max]` range.
 * @returns The course.
 */
function catalogCourse(
  seed: number,
  label: string,
  credits: number | readonly [number, number],
): Course {
  const isFixed = typeof credits === 'number';
  return createCourse({
    id: seedId('50000000', seed),
    tenantId: SEED_TENANT_ID,
    sourceCourseId: label.replace(' ', '-'),
    label,
    creditsHundredths: isFixed ? credits : null,
    minCreditsHundredths: isFixed ? null : credits[0],
    maxCreditsHundredths: isFixed ? null : credits[1],
    equivalencyGroupId: null,
  });
}

/** The seeded catalog, by key. */
export const SEED_CATALOG = {
  math101: catalogCourse(0x101, 'DEMO-MATH 101', 300),
  math102: catalogCourse(0x102, 'DEMO-MATH 102', 300),
  phys201: catalogCourse(0x201, 'DEMO-PHYS 201', 400),
  phys301: catalogCourse(0x301, 'DEMO-PHYS 301', 400),
  phys301Lab: catalogCourse(0x3010, 'DEMO-PHYS 301L', 100),
  engl101: catalogCourse(0x1101, 'DEMO-ENGL 101', 300),
  ind390: catalogCourse(0x390, 'DEMO-IND 390', [100, 300]),
} as const;

/**
 * Builds a COURSE prerequisite leaf with a letter minimum.
 *
 * @param course - Required course.
 * @param minimum - Minimum letter grade.
 * @returns The expression.
 */
function needs(course: Course, minimum: LetterGrade): PrerequisiteExpression {
  return createPrerequisiteExpression({
    type: PrerequisiteExpressionType.Course,
    courseId: course.id,
    minimumGrade: { scheme: GradeScheme.Letter, value: minimum },
  });
}

/**
 * Builds a prerequisite rule in the seeded ruleset version.
 *
 * @param course - Course the rule is for.
 * @param expression - Its prerequisite expression.
 * @returns The rule.
 */
function rule(course: Course, expression: PrerequisiteExpression): PrerequisiteRule {
  return createPrerequisiteRule({
    tenantId: SEED_TENANT_ID,
    courseId: course.id,
    expression,
    sourceRef: `demo-catalog-rule:${course.sourceCourseId}`,
    rulesetVersion: SEED_RULESET_VERSION,
  });
}

const { math101, math102, phys201, phys301 } = SEED_CATALOG;

/** Prerequisite rules of the seeded ruleset version. */
export const SEED_RULES: readonly PrerequisiteRule[] = [
  rule(math102, needs(math101, LetterGrade.C)),
  rule(phys201, needs(math101, LetterGrade.C)),
  // NOTE: the AND/OR rule: DEMO-PHYS 201, and either DEMO-MATH 102 or DEMO-MATH 101, each ≥ C.
  rule(
    phys301,
    createPrerequisiteExpression({
      type: PrerequisiteExpressionType.All,
      items: [
        needs(phys201, LetterGrade.C),
        createPrerequisiteExpression({
          type: PrerequisiteExpressionType.Any,
          items: [needs(math102, LetterGrade.C), needs(math101, LetterGrade.C)],
        }),
      ],
    }),
  ),
];

/** Academic policy of the seeded ruleset version. */
export const SEED_POLICY = createAcademicPolicy({
  tenantId: SEED_TENANT_ID,
  rulesetVersion: SEED_RULESET_VERSION,
  allowsInProgressPrerequisites: true,
  passSatisfiesMinimumGrade: null,
  // NOTE: written out highest first; the `LetterGrade` listing order carries no meaning.
  letterGradeOrder: [
    LetterGrade.APlus,
    LetterGrade.A,
    LetterGrade.AMinus,
    LetterGrade.BPlus,
    LetterGrade.B,
    LetterGrade.BMinus,
    LetterGrade.CPlus,
    LetterGrade.C,
    LetterGrade.CMinus,
    LetterGrade.DPlus,
    LetterGrade.D,
    LetterGrade.DMinus,
    LetterGrade.F,
  ],
  lowestPassingLetterGrade: LetterGrade.D,
  repeatPolicy: RepeatPolicy.MostRecent,
  termCreditBounds: { minCreditsHundredths: 1200, maxCreditsHundredths: 1800 },
});

/**
 * Builds one term of the seeded calendar.
 *
 * @param sequence - Position in the calendar; also the number in the term ID.
 * @param termCode - Term code such as `2026FA`.
 * @param dates - First and last day, `YYYY-MM-DD`.
 * @returns The term input.
 */
function term(
  sequence: number,
  termCode: string,
  dates: readonly [startsOn: string, endsOn: string],
): TermInput {
  const [startsOn, endsOn] = dates;
  return {
    id: seedId('b0000000', sequence),
    tenantId: SEED_TENANT_ID,
    termCode,
    startsOn,
    endsOn,
    sequence,
  };
}

// NOTE: covers every attempt's term, plus 2027SP, the term the scenarios plan for.
/** The seeded term calendar, oldest first. */
export const SEED_TERMS = createTermCalendar([
  term(1, '2025FA', ['2025-08-25', '2025-12-19']),
  term(2, '2026SP', ['2026-01-12', '2026-05-08']),
  term(3, '2026FA', ['2026-08-24', '2026-12-18']),
  term(4, '2027SP', ['2027-01-11', '2027-05-07']),
]);
