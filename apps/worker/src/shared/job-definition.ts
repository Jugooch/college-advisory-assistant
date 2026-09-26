/**
 * @file Shape every background job must implement.
 * @module @caa/worker/shared/job-definition
 */

/** A named background job with a handler. */
export interface JobDefinition<TPayload> {
  /** Queue name, kebab-case, for example `import-sections`. */
  readonly name: string;
  /**
   * Processes one job. Must be idempotent: the queue may deliver a job more than once.
   *
   * @param payload - Validated job payload.
   */
  readonly handle: (payload: TPayload) => Promise<void>;
}
