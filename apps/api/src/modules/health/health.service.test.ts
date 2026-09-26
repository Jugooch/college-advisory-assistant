/**
 * @file Tests for the health service.
 */
import { describe, expect, it } from 'vitest';

import { createHealthService } from './health.service';

describe('createHealthService', () => {
  it('reports the configured version and the injected clock time', () => {
    const service = createHealthService({
      version: '1.2.3',
      now: () => new Date('2026-09-25T12:00:00.000Z'),
    });

    expect(service.getSnapshot()).toEqual({
      version: '1.2.3',
      checkedAt: '2026-09-25T12:00:00.000Z',
    });
  });
});
