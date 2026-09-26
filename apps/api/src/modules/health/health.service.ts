/**
 * @file Business logic for the health check.
 * @module @caa/api/modules/health/health.service
 */

/** Snapshot of the API process status. */
export interface HealthSnapshot {
  readonly version: string;
  readonly checkedAt: string;
}

/** Dependencies of the health service. */
export interface HealthServiceDependencies {
  readonly version: string;
  /** Returns the current time. Injected so tests are deterministic. */
  readonly now: () => Date;
}

/** Reports API process health. */
export interface HealthService {
  getSnapshot(): HealthSnapshot;
}

/**
 * Creates the health service.
 *
 * @param dependencies - Application version and clock.
 * @returns A {@link HealthService}.
 */
export function createHealthService(dependencies: HealthServiceDependencies): HealthService {
  return {
    getSnapshot() {
      return { version: dependencies.version, checkedAt: dependencies.now().toISOString() };
    },
  };
}
