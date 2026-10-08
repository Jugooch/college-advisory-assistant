/**
 * @file Tests for the queue filter: what the query can select, who may choose Unrouted, and what
 * is sent to the API.
 */
import { describe, expect, it } from 'vitest';

import { CaseStatus } from '@caa/domain';

import { readQueueFilter, toFilterValue, toQueueQuery } from './queue-filter';

describe('readQueueFilter', () => {
  it('reads a status', () => {
    expect(readQueueFilter('OPEN', false)).toEqual({ kind: 'status', status: CaseStatus.Open });
  });

  it('lets an admin choose unrouted', () => {
    expect(readQueueFilter('unrouted', true)).toEqual({ kind: 'unrouted' });
  });

  it('gives an advisor every case when they ask for unrouted', () => {
    expect(readQueueFilter('unrouted', false)).toEqual({ kind: 'all' });
  });

  it('gives every case for a missing, repeated, or unknown value', () => {
    expect(readQueueFilter(undefined, true)).toEqual({ kind: 'all' });
    expect(readQueueFilter(['OPEN', 'RESOLVED'], true)).toEqual({ kind: 'all' });
    expect(readQueueFilter('../etc', true)).toEqual({ kind: 'all' });
    expect(readQueueFilter('all', true)).toEqual({ kind: 'all' });
  });
});

describe('toQueueQuery', () => {
  it('sends nothing for every case', () => {
    expect(toQueueQuery({ kind: 'all' })).toEqual({});
  });

  it('sends the status', () => {
    expect(toQueueQuery({ kind: 'status', status: CaseStatus.InReview })).toEqual({
      status: 'IN_REVIEW',
    });
  });

  it('sends the unrouted flag', () => {
    expect(toQueueQuery({ kind: 'unrouted' })).toEqual({ unrouted: true });
  });
});

describe('toFilterValue', () => {
  it('round-trips each filter through the form value', () => {
    expect(toFilterValue({ kind: 'all' })).toBe('all');
    expect(toFilterValue({ kind: 'status', status: CaseStatus.Resolved })).toBe('RESOLVED');
    expect(toFilterValue({ kind: 'unrouted' })).toBe('unrouted');
  });
});
