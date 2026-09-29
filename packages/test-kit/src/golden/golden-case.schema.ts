/**
 * @file The golden case format: complete synthetic inputs, the check to invoke, the expected
 *   per-check result, prohibited claims, and the adjudication record.
 * @module @caa/test-kit/golden/golden-case-schema
 * @requirement NFR-01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { z } from 'zod';

import {
  AcademicPolicySchema,
  AuditSnapshotSchema,
  CheckKind,
  CourseAttemptSchema,
  CourseIdSchema,
  CourseSchema,
  PrerequisiteRuleSchema,
  StudentSnapshotSchema,
  TermCalendarSchema,
} from '@caa/domain';

import { ExpectedCheckSchema, ProhibitedClaimSchema } from './golden-expectation.schema';
import { GoldenRuleFamilySchema } from './golden-rule-family';

/** Reviewer recorded until an academic domain owner adjudicates the case (planning/13). */
export const PENDING_ACADEMIC_REVIEW = 'pending-academic-review';

/**
 * Schema for one course of a candidate set. The golden format states it independently of the
 * engine's `CourseSelection` type, so the oracle doesn't import the code it checks.
 */
export const GoldenCourseSelectionSchema = z
  .object({
    course: CourseSchema,
    /** Chosen credits in hundredths for a variable-credit course, or `null` when none is chosen. */
    selectedCreditsHundredths: z.number().int().nonnegative().nullable(),
    /** `false` for a linked section whose credits are already included in its lecture's. */
    countsCredits: z.boolean(),
  })
  .strict()
  .readonly();

/**
 * Schema for the pinned student record the audit must reflect (the snapshot every other check
 * reads), and the partner's allowed skew between its time and the audit's record time.
 */
const PinnedRecordSchema = z
  .object({
    studentSnapshot: StudentSnapshotSchema,
    maxSkewMs: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();

/** Fields every golden case has, whatever check it invokes. */
const commonFields = {
  /** `GC-<FAMILY>-NNN` for development cases, `GH-<FAMILY>-NNN` for the frozen holdout. */
  id: z.string().regex(/^G[CH]-[A-Z]+-\d{3}$/),
  family: GoldenRuleFamilySchema,
  title: z.string().min(1),
  /** Requirement, test-family, and acceptance IDs the case evidences, for example `AC01`. */
  requirementIds: z.array(z.string().regex(/^(FR-\d{2}|NFR-\d{2}|T\d{2}|AC\d{2})$/)).min(1),
  /** Versions of every source the inputs stand for, for example `ruleset demo-2026.1`. */
  sourceVersions: z.array(z.string().min(1)).min(1),
  /** The checks the engine must return, in order. */
  expected: z.array(ExpectedCheckSchema).min(1),
  /** Other complete results an adjudicator accepted as equally correct; usually none. */
  allowedAlternatives: z.array(z.array(ExpectedCheckSchema).min(1)),
  prohibitedClaims: z.array(ProhibitedClaimSchema).min(1),
  rationale: z.string().min(1),
  /** Planning sections, issues, and recorded tech-lead decisions the expectation rests on. */
  citations: z.array(z.string().min(1)).min(1),
  reviewer: z.string().min(1),
  /** Date the expectation was written down, `YYYY-MM-DD`. */
  adjudicatedOn: z.iso.date(),
};

/** Schema for a case that evaluates a prerequisite rule against a student's attempts. */
const PrerequisiteCaseSchema = z.object({
  ...commonFields,
  check: z.literal(CheckKind.Prerequisite),
  inputs: z
    .object({
      academicPolicy: AcademicPolicySchema,
      termCalendar: TermCalendarSchema,
      courses: z.array(CourseSchema).readonly(),
      attempts: z.array(CourseAttemptSchema).readonly(),
      rule: PrerequisiteRuleSchema,
    })
    .strict()
    .readonly(),
});

/** Schema for a case that asks whether the audit lists a course for an outstanding requirement. */
const ApplicabilityCaseSchema = z.object({
  ...commonFields,
  check: z.literal(CheckKind.RequirementApplicability),
  inputs: z
    .object({ courseId: CourseIdSchema, audit: AuditSnapshotSchema, freshness: PinnedRecordSchema })
    .strict()
    .readonly(),
});

/** Schema for a case that checks a candidate set for courses competing for requirements. */
const AllocationCaseSchema = z.object({
  ...commonFields,
  check: z.literal(CheckKind.RequirementAllocation),
  inputs: z
    .object({
      candidates: z.array(GoldenCourseSelectionSchema).readonly(),
      audit: AuditSnapshotSchema,
      freshness: PinnedRecordSchema,
    })
    .strict()
    .readonly(),
});

/**
 * Schema for a case that checks a candidate set's credit load against the term credit bounds of
 * the academic policy (`termCreditBounds`, `null` when the institution supplied none).
 */
const CreditLoadCaseSchema = z.object({
  ...commonFields,
  check: z.literal(CheckKind.CreditLoad),
  inputs: z
    .object({
      selections: z.array(GoldenCourseSelectionSchema).readonly(),
      academicPolicy: AcademicPolicySchema,
    })
    .strict()
    .readonly(),
});

/**
 * Schema for one golden case (planning/13 §Golden corpus design). `check` names the engine check
 * the runner invokes, and `inputs` holds everything that check reads, so a case replays alone.
 */
export const GoldenCaseSchema = z
  .discriminatedUnion('check', [
    PrerequisiteCaseSchema,
    ApplicabilityCaseSchema,
    AllocationCaseSchema,
    CreditLoadCaseSchema,
  ])
  // SAFETY: an oracle that expects a result it also prohibits can never be met, and would hide
  // which of the two the adjudicator meant.
  .refine(
    (golden) =>
      [golden.expected, ...golden.allowedAlternatives]
        .flat()
        .every(
          (check) =>
            check.kind === golden.check &&
            golden.prohibitedClaims.every((claim) => claim.state !== check.state),
        ),
    {
      message: 'Expected checks must be of the invoked kind and must not have a prohibited state',
      path: ['expected'],
    },
  )
  .readonly();

/** A validated golden case. */
export type GoldenCase = z.infer<typeof GoldenCaseSchema>;

/** Raw input accepted by {@link defineGoldenCase}. */
export type GoldenCaseInput = z.input<typeof GoldenCaseSchema>;

/**
 * Validates one golden case.
 *
 * @param input - The case as written by the QA engineer.
 * @returns The validated case.
 * @throws {z.ZodError} When a field is invalid, an expected check has the wrong kind or a
 *   prohibited state, or PASS and a reason code don't agree.
 */
export function defineGoldenCase(input: GoldenCaseInput): GoldenCase {
  return GoldenCaseSchema.parse(input);
}

/**
 * Collects golden cases into a corpus, rejecting repeated case IDs.
 *
 * @param cases - The validated cases.
 * @returns The same cases, in order.
 * @throws {Error} When two cases share an ID.
 */
export function defineGoldenCorpus(cases: readonly GoldenCase[]): readonly GoldenCase[] {
  const seen = new Set<string>();
  const repeated = cases.map((golden) => golden.id).filter((id) => seen.size === seen.add(id).size);
  if (repeated.length > 0) {
    throw new Error(`Golden case IDs must be unique; repeated: ${repeated.join(', ')}`);
  }
  return cases;
}
