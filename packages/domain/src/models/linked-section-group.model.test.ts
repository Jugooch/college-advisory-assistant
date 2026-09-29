/**
 * @file Tests for the linked-section group data object.
 */
import { describe, expect, it } from 'vitest';

import {
  createLinkedSectionGroup,
  type LinkedSectionGroupInput,
} from './linked-section-group.model';

const PHYS_301_001 = '5ec71010-0000-4000-8000-000000000001';
const PHYS_301L_L01 = '5ec71010-0000-4000-8000-000000000011';
const PHYS_301L_L02 = '5ec71010-0000-4000-8000-000000000012';
const PHYS_301R_R01 = '5ec71010-0000-4000-8000-000000000021';
const PHYS_301L = 'c0a5e000-0000-4000-8000-000000000302';
const PHYS_301 = 'c0a5e000-0000-4000-8000-000000000301';

const LAB_GROUP: LinkedSectionGroupInput = {
  id: '1a2b3c4d-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  primarySectionId: PHYS_301_001,
  components: [
    { name: 'Lab', courseId: PHYS_301L, permittedSectionIds: [PHYS_301L_L01, PHYS_301L_L02] },
  ],
};

describe('createLinkedSectionGroup', () => {
  it('accepts a lecture that requires exactly one of two lab sections of another course', () => {
    expect(createLinkedSectionGroup(LAB_GROUP)).toEqual({
      id: '1a2b3c4d-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      primarySectionId: PHYS_301_001,
      components: [
        { name: 'Lab', courseId: PHYS_301L, permittedSectionIds: [PHYS_301L_L01, PHYS_301L_L02] },
      ],
    });
  });

  it('accepts two components, one in the primary section’s own course', () => {
    const recitation = {
      name: 'Recitation',
      courseId: PHYS_301,
      permittedSectionIds: [PHYS_301R_R01],
    };
    const group = createLinkedSectionGroup({
      ...LAB_GROUP,
      components: [...LAB_GROUP.components, recitation],
    });

    expect(group.components.map((component) => component.name)).toEqual(['Lab', 'Recitation']);
  });

  it('accepts a required component with no permitted section, which the engine reports as UNKNOWN', () => {
    const group = createLinkedSectionGroup({
      ...LAB_GROUP,
      components: [{ name: 'Lab', courseId: PHYS_301L, permittedSectionIds: [] }],
    });

    expect(group.components[0]?.permittedSectionIds).toEqual([]);
  });

  it('rejects a group with no components', () => {
    expect(() => createLinkedSectionGroup({ ...LAB_GROUP, components: [] })).toThrow();
  });

  it('rejects a component that repeats a section', () => {
    expect(() =>
      createLinkedSectionGroup({
        ...LAB_GROUP,
        components: [
          { name: 'Lab', courseId: PHYS_301L, permittedSectionIds: [PHYS_301L_L01, PHYS_301L_L01] },
        ],
      }),
    ).toThrow(/permittedSectionIds must not repeat a section/);
  });

  it('rejects a primary section that is also a permitted section', () => {
    expect(() =>
      createLinkedSectionGroup({
        ...LAB_GROUP,
        components: [{ name: 'Lab', courseId: PHYS_301, permittedSectionIds: [PHYS_301_001] }],
      }),
    ).toThrow(/The primary section must not be a permitted section/);
  });

  it('rejects one section permitted by two components', () => {
    expect(() =>
      createLinkedSectionGroup({
        ...LAB_GROUP,
        components: [
          { name: 'Lab', courseId: PHYS_301L, permittedSectionIds: [PHYS_301L_L01] },
          { name: 'Lab again', courseId: PHYS_301L, permittedSectionIds: [PHYS_301L_L01] },
        ],
      }),
    ).toThrow(/A section may be permitted by only one component/);
  });

  it('rejects a component with an empty name', () => {
    expect(() =>
      createLinkedSectionGroup({
        ...LAB_GROUP,
        components: [{ name: '', courseId: PHYS_301L, permittedSectionIds: [PHYS_301L_L01] }],
      }),
    ).toThrow();
  });
});
