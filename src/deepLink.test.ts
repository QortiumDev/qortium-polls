import { describe, expect, it } from 'vitest';
import { buildPollLink, getAppBaseAddress, getInitialPollRoute, parsePollRoute } from './deepLink';

describe('poll deep links', () => {
  it.each([
    ['', { kind: 'none' }],
    ['/', { kind: 'none' }],
    ['/1', { kind: 'poll', pollId: 1 }],
    ['001/', { kind: 'poll', pollId: 1 }],
    ['/2147483647', { kind: 'poll', pollId: 2_147_483_647 }],
  ])('parses %s', (path, expected) => {
    expect(parsePollRoute(path)).toEqual(expected);
  });

  it.each(['/0', '/-1', '/1/2', '/poll/1', '/2147483648', '/1.5'])('rejects %s', (path) => {
    expect(parsePollRoute(path)).toEqual({ kind: 'invalid', path });
  });

  it('prefers the path injected by Core', () => {
    expect(getInitialPollRoute(
      { pathname: '/render/APP/Polls/Polls/99' },
      { _qdnPath: '/42' },
    )).toEqual({ kind: 'poll', pollId: 42 });
  });

  it('supports a plain pathname during local browser development', () => {
    expect(getInitialPollRoute({ pathname: '/7' }, {})).toEqual({ kind: 'poll', pollId: 7 });
  });

  it('does not guess at a Core render path without injected globals', () => {
    expect(getInitialPollRoute({ pathname: '/render/APP/Polls/Polls/7' }, {})).toEqual({ kind: 'none' });
  });

  it('builds links using the current published identity', () => {
    const host = {
      _qdnService: 'APP',
      _qdnName: 'Poll Operator',
      _qdnIdentifier: 'polls.mirror.v1',
    };

    expect(getAppBaseAddress(host)).toBe('qdn://APP/Poll%20Operator/polls.mirror.v1');
    expect(buildPollLink(42, host)).toBe('qdn://APP/Poll%20Operator/polls.mirror.v1/42');
  });

  it('falls back to the canonical Polls identity', () => {
    expect(buildPollLink(1, {})).toBe('qdn://APP/Polls/Polls/1');
  });
});
