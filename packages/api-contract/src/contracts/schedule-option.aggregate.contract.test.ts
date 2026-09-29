/**
 * @file Tests that a schedule option's aggregate follows its academic checks as well as its schedule.
 */
import { describe, expect, it } from 'vitest';

import { buildOption, prerequisiteCheck } from '../testing/schedule-option-fixtures';
import { ScheduleOptionSchema } from './schedule-option.contract';

const accepts = (payload: unknown): boolean => ScheduleOptionSchema.safeParse(payload).success;

describe('ScheduleOptionSchema aggregate with academic checks', () => {
  it('accepts a CONDITIONAL prerequisite with a PASS schedule only as CONDITIONAL', () => {
    const prerequisite = prerequisiteCheck('CONDITIONAL');

    expect(accepts(buildOption({ prerequisite, aggregate: 'CONDITIONAL' }))).toBe(true);
    expect(accepts(buildOption({ prerequisite, aggregate: 'VALIDATED' }))).toBe(false);
  });

  it('keeps an option whose prerequisite FAILs, as BLOCKED and never VALIDATED (ADR-0010 §2)', () => {
    const prerequisite = prerequisiteCheck('FAIL');

    expect(accepts(buildOption({ prerequisite, aggregate: 'BLOCKED' }))).toBe(true);

    const result = ScheduleOptionSchema.safeParse(
      buildOption({ prerequisite, aggregate: 'VALIDATED' }),
    );

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'aggregate must follow the FAIL, UNKNOWN, CONDITIONAL, PASS precedence',
    ]);
  });
});
