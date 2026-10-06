/**
 * @file Tests for the display steps of the schedule-options response: the term minimized to its
 * display fields, and campus names paired with the IDs a response names.
 * @requirement FR-07
 * @requirement FR-08
 * @requirement NFR-04
 */
import { describe, expect, it } from 'vitest';

import { buildCampus, buildTerm, SYNTHETIC_CAMPUSES } from '@caa/test-kit';

import { selectCampusDisplays, toTermDisplay } from './schedule-options.logic';

const { north, south } = SYNTHETIC_CAMPUSES;

describe('toTermDisplay', () => {
  it('keeps the id, code and dates and drops the tenant and sequence', () => {
    const term = buildTerm({ termCode: '2027SP' }, 3);

    expect(toTermDisplay(term)).toEqual({
      id: term.id,
      termCode: '2027SP',
      startsOn: term.startsOn,
      endsOn: term.endsOn,
    });
  });
});

describe('selectCampusDisplays', () => {
  it('returns id and name only, in the order of the named IDs', () => {
    const { campuses, missingIds } = selectCampusDisplays([south.id, north.id], [north, south]);

    expect(campuses).toEqual([
      { id: south.id, name: south.name },
      { id: north.id, name: north.name },
    ]);
    expect(missingIds).toEqual([]);
  });

  it('reports a named campus with no row instead of dropping or naming it', () => {
    const extra = buildCampus({}, 9);

    const { campuses, missingIds } = selectCampusDisplays([north.id, south.id], [north, extra]);

    expect(campuses).toEqual([{ id: north.id, name: north.name }]);
    expect(missingIds).toEqual([south.id]);
  });

  it('returns nothing for no named campus, and lists no unnamed campus', () => {
    expect(selectCampusDisplays([], [north])).toEqual({ campuses: [], missingIds: [] });
  });
});
