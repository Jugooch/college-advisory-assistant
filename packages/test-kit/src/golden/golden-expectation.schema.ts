/**
 * @file Schemas for what a golden case expects from a check and which claims it prohibits.
 * @module @caa/test-kit/golden/golden-expectation-schema
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { z } from 'zod';

import {
  CheckKindSchema,
  CheckState,
  CheckStateSchema,
  CourseIdSchema,
  CreditLoadEvidenceSchema,
  DecisiveLeafSchema,
  ReasonCodeSchema,
} from '@caa/domain';

/**
 * Schema for the evidence a golden case asserts. Each field that is present is compared with
 * deep equality; a field that is omitted is not compared, because the case makes no claim about
 * it. Field meanings are those of the domain `CheckEvidence`.
 */
export const ExpectedEvidenceSchema = z
  .object({
    rulesetVersion: z.string().min(1).nullable().optional(),
    decisiveLeaves: z.array(DecisiveLeafSchema).readonly().optional(),
    courseIds: z.array(CourseIdSchema).readonly().optional(),
    creditLoad: CreditLoadEvidenceSchema.nullable().optional(),
  })
  .strict()
  .readonly();

/** Validated expected evidence. */
export type ExpectedEvidence = z.infer<typeof ExpectedEvidenceSchema>;

/**
 * Schema for one check a golden case expects. `reasonCode` is explicit: `null` means the check
 * must carry no reason code. `sourceRef` and `evidence` are compared only when present.
 */
export const ExpectedCheckSchema = z
  .object({
    kind: CheckKindSchema,
    state: CheckStateSchema,
    reasonCode: ReasonCodeSchema.nullable(),
    sourceRef: z.string().min(1).optional(),
    evidence: ExpectedEvidenceSchema.optional(),
  })
  .strict()
  // SAFETY: an expectation that pairs PASS with a reason, or a non-PASS with none, could only be
  // met by a check the domain itself rejects, so the case would be a broken oracle.
  .refine((check) => (check.state === CheckState.Pass) === (check.reasonCode === null), {
    message: 'An expected check has a reasonCode exactly when it is not PASS',
    path: ['reasonCode'],
  })
  .readonly();

/** A validated expected check. */
export type ExpectedCheck = z.infer<typeof ExpectedCheckSchema>;

/** Raw input accepted for an expected check. */
export type ExpectedCheckInput = z.input<typeof ExpectedCheckSchema>;

/**
 * Schema for a claim the engine must never make for this case (planning/13 §Golden corpus
 * design: prohibited claims). It is machine-checked: no returned check may have `state`.
 * `claim` says in words what that state would wrongly assert.
 */
export const ProhibitedClaimSchema = z
  .object({
    state: CheckStateSchema,
    claim: z.string().min(1),
  })
  .strict()
  .readonly();

/** A validated prohibited claim. */
export type ProhibitedClaim = z.infer<typeof ProhibitedClaimSchema>;

/** Raw input accepted for a prohibited claim. */
export type ProhibitedClaimInput = z.input<typeof ProhibitedClaimSchema>;
