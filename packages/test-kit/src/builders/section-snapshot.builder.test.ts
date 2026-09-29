/**
 * @file Tests for the synthetic section snapshot builder.
 */
import { describe, expect, it } from 'vitest';

import { SectionSnapshotSchema } from '@caa/domain';

import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';
import { buildLinkedSectionGroup } from './linked-section-group.builder';
import { buildSection } from './section.builder';
import { buildSectionSnapshot } from './section-snapshot.builder';

const LAB_COURSE_ID = '50000000-0000-4000-8000-000000000002';

describe('buildSectionSnapshot', () => {
  it('defaults to an empty 2027SP snapshot of tenant A, published 2026-09-20 06:00 -05:00', () => {
    expect(buildSectionSnapshot()).toEqual({
      id: 'c2000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      termId: 'b0000000-0000-4000-8000-000000000004',
      termStartsOn: '2027-01-11',
      termEndsOn: '2027-05-07',
      timezone: 'America/Chicago',
      sourceEffectiveAt: '2026-09-20T06:00:00.000-05:00',
      sections: [],
      linkedSectionGroups: [],
    });
  });

  it('derives the id from the seed', () => {
    expect(buildSectionSnapshot({}, 3).id).toBe('c2000000-0000-4000-8000-000000000003');
  });

  it('returns deep-equal snapshots for the same arguments', () => {
    expect(buildSectionSnapshot({ sections: [buildSection()] }, 2)).toEqual(
      buildSectionSnapshot({ sections: [buildSection()] }, 2),
    );
  });

  it('holds a lecture and its two permitted labs with the default linked-section group', () => {
    const snapshot = buildSectionSnapshot({
      sections: [
        buildSection({}, 1),
        buildSection({ courseId: LAB_COURSE_ID, sectionCode: 'L01' }, 2),
        buildSection({ courseId: LAB_COURSE_ID, sectionCode: 'L02' }, 3),
      ],
      linkedSectionGroups: [buildLinkedSectionGroup()],
    });

    expect(snapshot.sections.map((section) => [section.id, section.sectionCode])).toEqual([
      ['c0000000-0000-4000-8000-000000000001', '001'],
      ['c0000000-0000-4000-8000-000000000002', 'L01'],
      ['c0000000-0000-4000-8000-000000000003', 'L02'],
    ]);
    expect(snapshot.linkedSectionGroups[0]?.primarySectionId).toBe(
      'c0000000-0000-4000-8000-000000000001',
    );
  });

  it('returns a snapshot that passes the domain schema', () => {
    expect(SectionSnapshotSchema.safeParse(buildSectionSnapshot()).success).toBe(true);
  });

  it('rejects a linked-section group that names a section missing from the snapshot', () => {
    expect(() =>
      buildSectionSnapshot({
        sections: [buildSection({}, 1)],
        linkedSectionGroups: [buildLinkedSectionGroup()],
      }),
    ).toThrow();
  });

  it('rejects a section of another tenant', () => {
    expect(() =>
      buildSectionSnapshot({ sections: [buildSection({ tenantId: SYNTHETIC_TENANTS.b.id })] }),
    ).toThrow();
  });

  it('rejects two sections with the same source section ID', () => {
    expect(() =>
      buildSectionSnapshot({
        sections: [buildSection({}, 1), buildSection({ sourceSectionId: 'DEMO-SEC-001' }, 2)],
      }),
    ).toThrow();
  });
});
