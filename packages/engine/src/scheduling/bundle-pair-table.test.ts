/**
 * @file Tests for the bundle pair table: verdicts in either order, and shared section pairs.
 */
import { describe, expect, it } from 'vitest';

import { buildMeetingPattern, buildSection } from '@caa/test-kit';

import { buildPairTable } from './bundle-pair-table';

const LECTURE = buildSection({}, 1);
const LAB_ONE = buildSection(
  { meetings: [buildMeetingPattern({ startTime: '13:00', endTime: '13:50' })] },
  2,
);
const LAB_TWO = buildSection(
  { meetings: [buildMeetingPattern({ startTime: '15:00', endTime: '15:50' })] },
  3,
);
const CLASH = buildSection({}, 4);
const EVENING = buildSection(
  { meetings: [buildMeetingPattern({ startTime: '17:00', endTime: '17:50' })] },
  5,
);

describe('buildPairTable', () => {
  const table = buildPairTable(
    [
      { requestIndex: 0, sections: [LECTURE, LAB_ONE] },
      { requestIndex: 0, sections: [LECTURE, LAB_TWO] },
      { requestIndex: 1, sections: [CLASH] },
      { requestIndex: 2, sections: [EVENING] },
    ],
    null,
  );

  it('gives the same FAIL for both bundles that share the clashing lecture, in either order', () => {
    expect(table.verdictOf(0, 2).fail).toMatchObject({ reasonCode: 'MEETING_CONFLICT' });
    expect(table.verdictOf(2, 1)).toEqual(table.verdictOf(1, 2));
    expect(table.verdictOf(2, 1).fail?.check).toEqual(table.verdictOf(0, 2).fail?.check);
  });

  it('is compatible for bundles of one course, and outside the table', () => {
    expect(table.verdictOf(0, 1)).toEqual({ fail: null, unknownIssues: [] });
    expect(table.verdictOf(9, 10)).toEqual({ fail: null, unknownIssues: [] });
  });

  it('is compatible for bundles whose sections fit together', () => {
    expect(table.verdictOf(0, 3)).toEqual({ fail: null, unknownIssues: [] });
  });
});
