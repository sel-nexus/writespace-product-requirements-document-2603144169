/** Verify immutable stable sorting and UTC-pinned browser-local date formatting. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newestFirst, formatPostDate } from './posts.js';
import { post } from '../test/fixtures.js';

const timezone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'UTC'; });
afterAll(() => {
  if (timezone === undefined) delete process.env.TZ;
  else process.env.TZ = timezone;
});

describe('newestFirst', () => {
  it('sorts by creation epoch, not updatedAt, without mutating frozen records or source', () => {
    const oldest = Object.freeze({ ...post, title: 'Old', updatedAt: '2027-01-01T00:00:00.000Z' });
    const newest = Object.freeze({ ...post, title: 'New', createdAt: '2026-12-01T00:00:00.000Z' });
    const middle = Object.freeze({ ...post, title: 'Middle', createdAt: '2026-02-01T00:00:00.000Z' });
    const source = Object.freeze([oldest, newest, middle]);
    const sorted = newestFirst(source);
    expect(sorted).toEqual([newest, middle, oldest]);
    expect(sorted).not.toBe(source);
    expect(source).toEqual([oldest, newest, middle]);
    expect(sorted[0]).toBe(newest);
  });

  it('retains the original order of every equal-date group', () => {
    const a = { ...post, title: 'First tie' };
    const b = { ...post, title: 'Second tie' };
    const c = { ...post, title: 'Later first', createdAt: '2026-02-01T00:00:00.000Z' };
    const d = { ...c, title: 'Later second' };
    expect(newestFirst([a, c, b, d])).toEqual([c, d, a, b]);
  });

  it('returns independent arrays for empty and single-item inputs', () => {
    const empty = [];
    const single = [post];
    expect(newestFirst(empty)).toEqual([]);
    expect(newestFirst(empty)).not.toBe(empty);
    expect(newestFirst(single)).toEqual([post]);
    expect(newestFirst(single)).not.toBe(single);
  });
});

describe('formatPostDate', () => {
  it.each([
    ['2026-01-01T00:00:00.000Z', 'Jan 01, 2026'],
    ['2024-02-29T23:59:59.999Z', 'Feb 29, 2024'],
    ['2026-12-31T23:59:59.999Z', 'Dec 31, 2026'],
    ['2027-01-01T00:00:00.000Z', 'Jan 01, 2027'],
  ])('formats %s as %s in pinned UTC', (timestamp, expected) => {
    expect(formatPostDate(timestamp)).toBe(expected);
  });

  it('uses browser-local calendar formatting rather than forcing UTC in production', () => {
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatPostDate('2026-01-01T00:30:00.000Z')).toBe('Dec 31, 2025');
    } finally {
      process.env.TZ = 'UTC';
    }
  });
});
