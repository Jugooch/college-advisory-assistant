/**
 * @file Private case-reason rules shared by the case request and conversation block contracts.
 * @module @caa/api-contract/case-reason-rules
 * @requirement FR-12, FR-17
 *
 * Not re-exported from `index.ts`: these are schema-only checks, not shared invariants
 * (ADR-0005), so they must not become public domain or contract API.
 */
import { CaseReason } from '@caa/domain';

/**
 * Returns whether a case has the plan its reason needs: every reason except SOURCE_DISCREPANCY
 * is a review of a plan.
 *
 * @param reason - Why the case is opened.
 * @param hasPlan - Whether a plan is attached.
 * @returns `true` when the plan requirement holds.
 */
export const isCasePlanSatisfied = (reason: CaseReason, hasPlan: boolean): boolean =>
  reason === CaseReason.SourceDiscrepancy || hasPlan;

/**
 * Returns whether a case's subject agrees with its reason: a discrepancy subject is present
 * exactly when the reason is SOURCE_DISCREPANCY.
 *
 * @param reason - Why the case is opened.
 * @param hasSubject - Whether a discrepancy subject is set.
 * @returns `true` when the pair is consistent.
 */
export const isCaseSubjectConsistent = (reason: CaseReason, hasSubject: boolean): boolean =>
  (reason === CaseReason.SourceDiscrepancy) === hasSubject;
