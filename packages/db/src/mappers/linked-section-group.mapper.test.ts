/**
 * @file Tests for the linked-section group row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type {
  SectionLinkComponentRow,
  SectionLinkGroupRow,
  SectionLinkMemberRow,
} from '../tables/section-link-group.table';
import { toLinkedSectionGroup } from './linked-section-group.mapper';

const TENANT_ID = '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f';
const SNAPSHOT_ID = 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081';
const LAB_COURSE = '3c4d5e6f-7081-4a92-8b3c-4d5e6f708192';
const PHYS_COURSE = '4d5e6f70-8192-4a3b-8c4d-5e6f70819203';
const PRIMARY = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const L01 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const L02 = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f';

const GROUP: SectionLinkGroupRow = {
  id: 'f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f708190',
  tenantId: TENANT_ID,
  sectionSnapshotId: SNAPSHOT_ID,
  primarySectionId: PRIMARY,
};

const component = (position: number, name: string, courseId: string): SectionLinkComponentRow => ({
  tenantId: TENANT_ID,
  sectionSnapshotId: SNAPSHOT_ID,
  groupId: GROUP.id,
  position,
  name,
  courseId,
});

const member = (
  componentPosition: number,
  sectionId: string,
  position: number,
): SectionLinkMemberRow => ({
  tenantId: TENANT_ID,
  sectionSnapshotId: SNAPSHOT_ID,
  groupId: GROUP.id,
  componentPosition,
  courseId: LAB_COURSE,
  sectionId,
  position,
});

describe('toLinkedSectionGroup', () => {
  it('gives each component its own members in order, and an empty list when it has none', () => {
    const group = toLinkedSectionGroup(
      GROUP,
      [component(0, 'Lab', LAB_COURSE), component(1, 'Recitation', PHYS_COURSE)],
      [member(0, L02, 0), member(0, L01, 1)],
    );

    expect(group).toEqual({
      id: GROUP.id,
      tenantId: TENANT_ID,
      primarySectionId: PRIMARY,
      components: [
        { name: 'Lab', courseId: LAB_COURSE, permittedSectionIds: [L02, L01] },
        { name: 'Recitation', courseId: PHYS_COURSE, permittedSectionIds: [] },
      ],
    });
  });

  it('rejects a stored group whose primary section is also permitted', () => {
    expect(() =>
      toLinkedSectionGroup(GROUP, [component(0, 'Lab', LAB_COURSE)], [member(0, PRIMARY, 0)]),
    ).toThrow(ZodError);
  });

  it('rejects a stored group with no components', () => {
    expect(() => toLinkedSectionGroup(GROUP, [], [])).toThrow(ZodError);
  });
});
