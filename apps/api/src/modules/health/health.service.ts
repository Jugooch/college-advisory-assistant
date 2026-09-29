/**
 * @file Business logic for the health check.
 * @module @caa/api/modules/health/health.service
 */
import type { AuthMode } from '@caa/domain';

/** Snapshot of the API process status. */
export interface HealthSnapshot {
  readonly version: string;
  readonly checkedAt: string;
  /** The configured `AUTH_MODE`, so the web offers dev sign-in only when the API accepts it. */
  readonly authMode: AuthMode;
}

/** Dependencies of the health service. */
export interface HealthServiceDependencies {
  readonly version: string;
  /** Returns the current time. Injected so tests are deterministic. */
  readonly now: () => Date;
  /** Validated `AUTH_MODE`. */
  readonly authMode: AuthMode;
}

/** Reports API process health. */
export interface HealthService {
  /**
   * Reads the current process status.
   *
   * @returns The version and the time of the check.
   */
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
      const { version, authMode } = dependencies;
      return { version, checkedAt: dependencies.now().toISOString(), authMode };
    },
  };
}
