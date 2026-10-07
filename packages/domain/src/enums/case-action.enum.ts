/**
 * @file Actions that change an advisor case.
 * @module @caa/domain/enums/case-action
 * @requirement FR-12
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

/** An action recorded as a case event. */
export const CaseAction = {
  /** Opens the case. Always sequence 1. */
  Create: 'CREATE',
  /** An advisor takes the case. */
  Claim: 'CLAIM',
  /** The owner gives the case back. */
  Release: 'RELEASE',
  /** The owner closes the case with a resolution. */
  Resolve: 'RESOLVE',
  /** The student closes the case. */
  Withdraw: 'WITHDRAW',
} as const;

/** Union of every {@link CaseAction} value. */
export type CaseAction = (typeof CaseAction)[keyof typeof CaseAction];

/** Runtime schema for {@link CaseAction}. */
export const CaseActionSchema = z.enum(CaseAction);
