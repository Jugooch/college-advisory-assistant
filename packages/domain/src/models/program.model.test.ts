/**
 * @file Tests for the program identity.
 */
import { describe, expect, it } from 'vitest';

import { ProgramIdSchema } from './program.model';

describe('ProgramIdSchema', () => {
  it('accepts a UUID', () => {
    expect(ProgramIdSchema.parse('708192a3-0000-4000-8000-000000000001')).toBe(
      '708192a3-0000-4000-8000-000000000001',
    );
  });

  it('rejects a source program code, because internal IDs are UUIDs', () => {
    expect(ProgramIdSchema.safeParse('BS-MATH').success).toBe(false);
  });
});
