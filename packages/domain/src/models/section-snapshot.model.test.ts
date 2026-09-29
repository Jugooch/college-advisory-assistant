/**
 * @file Tests for the section snapshot data object.
 */
import { describe, expect, it } from 'vitest';

import type { LinkedSectionGroupInput } from './linked-section-group.model';
import type { SectionInput } from './section.model';
import { createSectionSnapshot, type SectionSnapshotInput } from './section-snapshot.model';

const TENANT_ID = '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f';
const OTHER_TENANT_ID = '1c9a7b47-4a8f-4b64-8d2f-9a2c3d4e5f60';
const TERM_ID = '92a3b4c5-0000-4000-8000-000000000003';
const PHYS_301 = 'c0a5e000-0000-4000-8000-000000000301';
const PHYS_301L = 'c0a5e000-0000-4000-8000-000000000302';

const LECTURE: SectionInput = {
  id: '5ec71010-0000-4000-8000-000000000001',
  tenantId: TENANT_ID,
  termId: TERM_ID,
  courseId: PHYS_301,
  sourceSectionId: 'PHYS301-001',
  sectionCode: '001',
  campusId: null,
  modality: 'ONLINE_ASYNCHRONOUS',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  meetings: [],
};

const LAB_L01: SectionInput = {
  ...LECTURE,
  id: '5ec71010-0000-4000-8000-000000000011',
  courseId: PHYS_301L,
  sourceSectionId: 'PHYS301L-L01',
  sectionCode: 'L01',
};

const LAB_L02: SectionInput = {
  ...LAB_L01,
  id: '5ec71010-0000-4000-8000-000000000012',
  sourceSectionId: 'PHYS301L-L02',
  sectionCode: 'L02',
};

const LAB_GROUP: LinkedSectionGroupInput = {
  id: '1a2b3c4d-0000-4000-8000-000000000001',
  tenantId: TENANT_ID,
  primarySectionId: LECTURE.id,
  components: [{ name: 'Lab', courseId: PHYS_301L, permittedSectionIds: [LAB_L01.id, LAB_L02.id] }],
};

const SNAPSHOT: SectionSnapshotInput = {
  id: '5a7b0000-0000-4000-8000-000000000001',
  tenantId: TENANT_ID,
  termId: TERM_ID,
  termStartsOn: '2026-08-24',
  termEndsOn: '2026-12-11',
  timezone: 'America/Chicago',
  sourceEffectiveAt: '2026-07-01T06:00:00-05:00',
  sections: [LECTURE, LAB_L01, LAB_L02],
  linkedSectionGroups: [LAB_GROUP],
};

describe('createSectionSnapshot', () => {
  it('accepts a term’s sections and a lecture-lab link group', () => {
    const snapshot = createSectionSnapshot(SNAPSHOT);

    expect(snapshot.sections.map((section) => section.sectionCode)).toEqual(['001', 'L01', 'L02']);
    expect(snapshot.linkedSectionGroups[0]?.primarySectionId).toBe(LECTURE.id);
  });

  it('accepts an empty snapshot', () => {
    const snapshot = createSectionSnapshot({ ...SNAPSHOT, sections: [], linkedSectionGroups: [] });

    expect([snapshot.sections, snapshot.linkedSectionGroups]).toEqual([[], []]);
  });

  it('accepts a required component with no permitted section', () => {
    const group = {
      ...LAB_GROUP,
      components: [{ name: 'Lab', courseId: PHYS_301L, permittedSectionIds: [] }],
    };

    expect(
      createSectionSnapshot({ ...SNAPSHOT, linkedSectionGroups: [group] }).linkedSectionGroups,
    ).toHaveLength(1);
  });

  it('rejects a section from another tenant', () => {
    expect(() =>
      createSectionSnapshot({
        ...SNAPSHOT,
        sections: [LECTURE, LAB_L01, { ...LAB_L02, tenantId: OTHER_TENANT_ID }],
      }),
    ).toThrow(/Every section must belong to the snapshot's tenant and term/);
  });

  it('rejects a section from another term', () => {
    const otherTerm = { ...LAB_L02, termId: '92a3b4c5-0000-4000-8000-000000000002' };

    expect(() =>
      createSectionSnapshot({ ...SNAPSHOT, sections: [LECTURE, LAB_L01, otherTerm] }),
    ).toThrow(/Every section must belong to the snapshot's tenant and term/);
  });

  it('rejects a duplicate sourceSectionId', () => {
    const duplicate = { ...LAB_L02, sourceSectionId: 'PHYS301L-L01' };

    expect(() =>
      createSectionSnapshot({ ...SNAPSHOT, sections: [LECTURE, LAB_L01, duplicate] }),
    ).toThrow(/Section id and sourceSectionId must be unique/);
  });

  it('rejects a duplicate section id', () => {
    const duplicate = { ...LAB_L02, id: LAB_L01.id };

    expect(() =>
      createSectionSnapshot({ ...SNAPSHOT, sections: [LECTURE, LAB_L01, duplicate] }),
    ).toThrow(/Section id and sourceSectionId must be unique/);
  });

  it.each([
    { startsOn: '2026-08-23', endsOn: '2026-12-11' },
    { startsOn: '2026-08-24', endsOn: '2026-12-12' },
  ])('rejects a section outside the term %j', (dates) => {
    expect(() =>
      createSectionSnapshot({
        ...SNAPSHOT,
        sections: [LECTURE, LAB_L01, { ...LAB_L02, ...dates }],
      }),
    ).toThrow(/Every section must fall within the term dates/);
  });

  it('rejects term dates that are reversed', () => {
    expect(() => createSectionSnapshot({ ...SNAPSHOT, termStartsOn: '2026-12-12' })).toThrow(
      /termStartsOn must not be later than termEndsOn/,
    );
  });

  it('rejects a link group from another tenant', () => {
    expect(() =>
      createSectionSnapshot({
        ...SNAPSHOT,
        linkedSectionGroups: [{ ...LAB_GROUP, tenantId: OTHER_TENANT_ID }],
      }),
    ).toThrow(/Every linked-section group must belong to the snapshot's tenant/);
  });

  it('rejects two link groups for one primary section', () => {
    const second = { ...LAB_GROUP, id: '1a2b3c4d-0000-4000-8000-000000000002' };

    expect(() =>
      createSectionSnapshot({ ...SNAPSHOT, linkedSectionGroups: [LAB_GROUP, second] }),
    ).toThrow(/Linked-section group id and primarySectionId must be unique/);
  });

  it('rejects a link group whose primary section is not in the snapshot', () => {
    expect(() => createSectionSnapshot({ ...SNAPSHOT, sections: [LAB_L01, LAB_L02] })).toThrow(
      /Every linked section must be in the snapshot/,
    );
  });

  it('rejects a permitted section that is not in the snapshot', () => {
    expect(() => createSectionSnapshot({ ...SNAPSHOT, sections: [LECTURE, LAB_L01] })).toThrow(
      /Every linked section must be in the snapshot/,
    );
  });

  it('rejects a permitted section of a different course than its component', () => {
    const group = {
      ...LAB_GROUP,
      components: [{ name: 'Lab', courseId: PHYS_301, permittedSectionIds: [LAB_L01.id] }],
    };

    expect(() => createSectionSnapshot({ ...SNAPSHOT, linkedSectionGroups: [group] })).toThrow(
      /belong to its component's course/,
    );
  });

  it('rejects a source effective time without an offset', () => {
    expect(() =>
      createSectionSnapshot({ ...SNAPSHOT, sourceEffectiveAt: '2026-07-01T06:00:00' }),
    ).toThrow();
  });
});
