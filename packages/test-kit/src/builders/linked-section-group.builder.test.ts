/**
 * @file Tests for the synthetic linked-section group builders.
 */
import { describe, expect, it } from 'vitest';

import { LinkedSectionGroupSchema } from '@caa/domain';

import {
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
} from './linked-section-group.builder';

const LAB_COMPONENT = {
  name: 'Lab',
  courseId: '50000000-0000-4000-8000-000000000002',
  permittedSectionIds: [
    'c0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000003',
  ],
};

describe('buildLinkedSectionComponent', () => {
  it('defaults to a lab of course seed 2 permitting section seeds 2 and 3', () => {
    expect(buildLinkedSectionComponent()).toEqual(LAB_COMPONENT);
  });

  it('accepts an empty permitted list, which the engine reports as UNKNOWN', () => {
    expect(buildLinkedSectionComponent({ permittedSectionIds: [] }).permittedSectionIds).toEqual(
      [],
    );
  });

  it('rejects a repeated permitted section', () => {
    expect(() =>
      buildLinkedSectionComponent({
        permittedSectionIds: [
          'c0000000-0000-4000-8000-000000000002',
          'c0000000-0000-4000-8000-000000000002',
        ],
      }),
    ).toThrow();
  });
});

describe('buildLinkedSectionGroup', () => {
  it('defaults to primary section seed 1 requiring one lab, section seed 2 or 3', () => {
    expect(buildLinkedSectionGroup()).toEqual({
      id: 'c1000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      primarySectionId: 'c0000000-0000-4000-8000-000000000001',
      components: [LAB_COMPONENT],
    });
  });

  it('derives the id from the seed', () => {
    expect(buildLinkedSectionGroup({}, 7).id).toBe('c1000000-0000-4000-8000-000000000007');
  });

  it('returns deep-equal groups for the same arguments', () => {
    expect(buildLinkedSectionGroup({}, 2)).toEqual(buildLinkedSectionGroup({}, 2));
  });

  it('returns a group that passes the domain schema', () => {
    expect(LinkedSectionGroupSchema.safeParse(buildLinkedSectionGroup()).success).toBe(true);
  });

  it('rejects a group whose primary section is also a permitted section', () => {
    expect(() =>
      buildLinkedSectionGroup({ primarySectionId: 'c0000000-0000-4000-8000-000000000002' }),
    ).toThrow();
  });

  it('rejects a group with no components', () => {
    expect(() => buildLinkedSectionGroup({ components: [] })).toThrow();
  });
});
