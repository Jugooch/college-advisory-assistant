/**
 * @file Error codes shared by the API, the API client, and the UI.
 * @module @caa/domain/enums/error-code
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/** Every error code the API may return. Raw vendor errors are never exposed. */
export const ErrorCode = {
  InvalidRequest: 'INVALID_REQUEST',
  Unauthorized: 'UNAUTHORIZED',
  NotFound: 'NOT_FOUND',
  OutOfScope: 'OUT_OF_SCOPE',
  SourceUnavailable: 'SOURCE_UNAVAILABLE',
  StaleSource: 'STALE_SOURCE',
  SemanticGap: 'SEMANTIC_GAP',
  RevisionConflict: 'REVISION_CONFLICT',
  SearchTimeout: 'SEARCH_TIMEOUT',
  NoFeasiblePlan: 'NO_FEASIBLE_PLAN',
  InternalError: 'INTERNAL_ERROR',
} as const;

/** Union of every {@link ErrorCode} value. */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Runtime schema for {@link ErrorCode}. */
export const ErrorCodeSchema = z.enum(ErrorCode);
