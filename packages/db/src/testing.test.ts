/**
 * @file Tests that the `@caa/db/testing` entry point exposes the seed scenario writer.
 */
import { describe, expect, it } from 'vitest';

import * as testing from './testing';

describe('@caa/db/testing', () => {
  it('exports the seed scenario writer and the test database opener', () => {
    expect(typeof testing.writeSeedScenario).toBe('function');
    expect(typeof testing.openTestDatabase).toBe('function');
  });

  it('exposes the demo seed plan builder', () => {
    expect(typeof testing.buildDemoSeedPlan).toBe('function');
  });

  it('exposes the dev seed plan builder so a test can derive its own plan', () => {
    const plan = testing.buildDevSeedPlan(new Date('2026-10-01T12:00:00.000Z'));

    expect(plan.students.map((student) => student.sourceStudentId)).toContain('SYN-000001');
    expect(plan.identities.every((identity) => identity.issuer === testing.DEV_SEED_ISSUER)).toBe(
      true,
    );
  });

  it('rejects an invalid run time before touching the database', async () => {
    await expect(
      testing.writeSeedScenario({} as never, { now: new Date(Number.NaN) }),
    ).rejects.toThrow(RangeError);
  });
});
