/**
 * @file Shape every background job must implement.
 * @module @caa/worker/shared/job-definition
 */

/** A named background job with a handler. */
export interface JobDefinition<TPayload, TResult = unknown> {
  /** Queue name, kebab-case, for example `import-sections`. */
  readonly name: string;
  /**
   * Processes one job. Must be idempotent: the queue may deliver a job more than once.
   *
   * @param payload - Job payload. Jobs that accept `unknown` validate it themselves.
   * @returns The job's typed result, for callers and tests; the queue ignores it.
   */
  readonly handle: (payload: TPayload) => Promise<TResult>;
}
