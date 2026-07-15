import { describe, expect, it } from 'vitest';
import {
  friendlyWriteError,
  getAccountVoteIndexes,
  preservedDateInputValue,
  responseData,
  toDateInput,
  versionAtLeast,
} from './pollFormat';

describe('versionAtLeast', () => {
  it.each([
    ['1.4.2', true],
    ['1.4.10', true],
    ['1.10.0', true],
    ['2.0.0', true],
    ['1.4.1', false],
    [undefined, false],
  ])('compares %s against 1.4.2', (version, expected) => {
    expect(versionAtLeast(version)).toBe(expected);
  });
});

describe('friendlyWriteError', () => {
  const fallback = 'Browsing works everywhere; creating and voting need a local Core or trusted custom node.';

  it.each([
    [new Error('PUBLIC_NODE_READ_ONLY'), fallback],
    [new Error('Public network node is read-only'), fallback],
    [new Error('Request denied'), 'Request denied'],
    [new Error(''), fallback],
    ['not an error', fallback],
  ])('returns a useful write error for %#', (error, expected) => {
    expect(friendlyWriteError(error, fallback)).toBe(expected);
  });
});

describe('node response and poll edit helpers', () => {
  it('throws the Core response body for a failed FETCH_NODE_API envelope', () => {
    expect(() => responseData({
      body: 'POLL_NO_EXISTS',
      data: null,
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })).toThrow('POLL_NO_EXISTS');
  });

  it('unwraps successful FETCH_NODE_API data', () => {
    expect(responseData({ body: '[]', data: [1, 2], ok: true, status: 200, statusText: 'OK' })).toEqual([1, 2]);
  });

  it('preserves exact milliseconds when an existing start input is unchanged', () => {
    const original = Date.UTC(2026, 6, 15, 12, 34, 56, 789);

    expect(preservedDateInputValue(toDateInput(original), original)).toBe(original);
  });

  it('finds both modern and legacy stored vote indexes', () => {
    expect(getAccountVoteIndexes({ voteDetails: [{ voterAddress: 'Qone', optionIndexes: [1, 3] }] }, 'Qone'))
      .toEqual([1, 3]);
    expect(getAccountVoteIndexes({ voteDetails: [{ voterAddress: 'Qone', optionIndex: 2 }] }, 'Qone'))
      .toEqual([2]);
    expect(getAccountVoteIndexes({ voteDetails: [{ voterAddress: 'Qtwo', optionIndexes: [1] }] }, 'Qone'))
      .toEqual([]);
  });
});
