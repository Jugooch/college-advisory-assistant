/**
 * @file Tests for the health service.
 */
import { describe, expect, it } from 'vitest';

import { AuthMode } from '@caa/domain';

import { createHealthService } from './health.service';

describe('createHealthService', () => {
  it.each([AuthMode.None, AuthMode.Dev])(
    'reports the version, the injected clock time, and auth mode %s',
    (authMode) => {
      const service = createHealthService({
        version: '1.2.3',
        now: () => new Date('2026-09-25T12:00:00.000Z'),
        authMode,
      });

      expect(service.getSnapshot()).toEqual({
        version: '1.2.3',
        checkedAt: '2026-09-25T12:00:00.000Z',
        authMode,
      });
    },
  );
});
