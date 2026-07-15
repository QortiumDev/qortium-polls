import { describe, expect, it } from 'vitest';
import { friendlyWriteError, versionAtLeast } from './pollFormat';

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
