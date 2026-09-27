/**
 * @file Grading schemes a course attempt's grade can be recorded under, and their value sets.
 * @module @caa/domain/enums/grade-scheme
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/**
 * Scheme a grade was recorded under.
 *
 * `UNKNOWN` means the source supplied a grade value but not a scheme the app recognizes. The
 * engine treats such a grade as UNKNOWN evidence, never as a pass.
 */
export const GradeScheme = {
  Letter: 'LETTER',
  PassFail: 'PASS_FAIL',
  Numeric: 'NUMERIC',
  Unknown: 'UNKNOWN',
} as const;

/** Union of every {@link GradeScheme} value. */
export type GradeScheme = (typeof GradeScheme)[keyof typeof GradeScheme];

/** Runtime schema for {@link GradeScheme}. */
export const GradeSchemeSchema = z.enum(GradeScheme);

/**
 * Closed set of letter grade values, valid only with {@link GradeScheme} `LETTER`.
 *
 * The listing order is for readability only and carries no academic meaning. Grade ordering
 * and grade points are institution policy, supplied as configuration and applied by the engine.
 * `P` is never a letter grade.
 */
export const LetterGrade = {
  APlus: 'A+',
  A: 'A',
  AMinus: 'A-',
  BPlus: 'B+',
  B: 'B',
  BMinus: 'B-',
  CPlus: 'C+',
  C: 'C',
  CMinus: 'C-',
  DPlus: 'D+',
  D: 'D',
  DMinus: 'D-',
  F: 'F',
} as const;

/** Union of every {@link LetterGrade} value. */
export type LetterGrade = (typeof LetterGrade)[keyof typeof LetterGrade];

/** Runtime schema for {@link LetterGrade}. */
export const LetterGradeSchema = z.enum(LetterGrade);

/** Closed set of pass/fail grade values, valid only with {@link GradeScheme} `PASS_FAIL`. */
export const PassFailGrade = {
  Pass: 'P',
  Fail: 'F',
} as const;

/** Union of every {@link PassFailGrade} value. */
export type PassFailGrade = (typeof PassFailGrade)[keyof typeof PassFailGrade];

/** Runtime schema for {@link PassFailGrade}. */
export const PassFailGradeSchema = z.enum(PassFailGrade);
