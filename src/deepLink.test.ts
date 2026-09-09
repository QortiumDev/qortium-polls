import { describe, expect, it } from 'vitest';
import {
  buildPollLink,
  getAppBaseAddress,
  getCurrentPollRoute,
  getInitialPollRoute,
  getPollRouteUrl,
  getPollTabRouteUrl,
  parsePollRoute,
} from './deepLink';

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

  it('updates and clears rendered-app poll paths without retaining the original poll', () => {
    const host = {
      _qdnBase: '/render/APP/Polls/Polls',
      _qdnPath: '/42',
    };

    expect(getPollRouteUrl(43, { pathname: '/render/APP/Polls/Polls/42' }, host))
      .toBe('/render/APP/Polls/Polls/43');
    expect(getPollRouteUrl(null, { pathname: '/render/APP/Polls/Polls/42' }, host))
      .toBe('/render/APP/Polls/Polls');
  });

  it('preserves host query parameters and the fragment when changing rendered-app poll paths', () => {
    const host = {
      _qdnBase: '/render/APP/Polls/Polls',
      _qdnPath: '/42',
    };
    const location = {
      hash: '#results',
      pathname: '/render/APP/Polls/Polls/42',
      search: '?theme=dark&qdnHomeBridge=bridge-token&lang=fr',
    };

    expect(getPollRouteUrl(43, location, host)).toBe(
      '/render/APP/Polls/Polls/43?theme=dark&qdnHomeBridge=bridge-token&lang=fr#results',
    );
    expect(getPollRouteUrl(null, location, host)).toBe(
      '/render/APP/Polls/Polls?theme=dark&qdnHomeBridge=bridge-token&lang=fr#results',
    );
  });

  it('reads the current browser route instead of the stale injected initial path', () => {
    const host = {
      _qdnBase: '/render/APP/Polls/Polls',
      _qdnPath: '/42',
    };

    expect(getCurrentPollRoute({ pathname: '/render/APP/Polls/Polls/43' }, host))
      .toEqual({ kind: 'poll', pollId: 43 });
    expect(getCurrentPollRoute({ pathname: '/render/APP/Polls/Polls' }, host))
      .toEqual({ kind: 'none' });
  });

  it('updates and clears local-development poll paths', () => {
    expect(getPollRouteUrl(43, { pathname: '/42' }, {})).toBe('/43');
    expect(getPollRouteUrl(null, { pathname: '/42' }, {})).toBe('/');
  });

  it('preserves local-development query parameters and fragments', () => {
    expect(
      getPollRouteUrl(
        43,
        { hash: '#details', pathname: '/42', search: '?theme=light&accent=blue' },
        {},
      ),
    ).toBe('/43?theme=light&accent=blue#details');
  });
});


describe('Developers workspace routing', () => {
  it.each(['developers', 'developer', 'reference'])('reads view=%s ahead of a poll path and another tab', view => {
    expect(getInitialPollRoute({ pathname: '/42', search: `?view=${view}&tab=create` }, {})).toEqual({ kind: 'workspace', tab: 'reference' });
    expect(getCurrentPollRoute({ pathname: '/42', search: `?view=${view}` }, {})).toEqual({ kind: 'workspace', tab: 'reference' });
  });
  it('preserves the poll context and host values while canonicalizing aliases', () => {
    const url = getPollTabRouteUrl('reference', { pathname: '/render/APP/Mirror/id/42', search: '?view=reference&view=developer&tab=mine&theme=dark&future=a&future=b&qdnHomeBridge=test', hash: '#reference-reads' });
    const parsed = new URL(url, 'https://example.test');
    expect(parsed.pathname).toBe('/render/APP/Mirror/id/42');
    expect(parsed.searchParams.getAll('view')).toEqual(['developers']);
    expect(parsed.searchParams.has('tab')).toBe(false);
    expect(parsed.searchParams.getAll('future')).toEqual(['a', 'b']);
    expect(parsed.searchParams.get('qdnHomeBridge')).toBe('test');
    expect(parsed.hash).toBe('#reference-reads');
    expect(getCurrentPollRoute({ pathname: parsed.pathname, search: parsed.search }, { _qdnBase: '/render/APP/Mirror/id' })).toEqual({ kind: 'workspace', tab: 'reference' });
    const browse = new URL(getPollTabRouteUrl('browse', parsed), parsed);
    expect(getCurrentPollRoute(browse, { _qdnBase: '/render/APP/Mirror/id', _qdnPath: '/99' })).toEqual({ kind: 'poll', pollId: 42 });
  });
  it('clears workspace keys when opening another poll and keeps unknown query repetitions', () => {
    expect(getPollRouteUrl(7, { pathname: '/42', search: '?view=developers&tab=mine&future=a&future=b', hash: '#x' }, {})).toBe('/7?future=a&future=b#x');
    expect(getCurrentPollRoute({ pathname: '/42', search: '?view=unknown' }, {})).toEqual({ kind: 'poll', pollId: 42 });
  });
  it.each(['create', 'mine'] as const)('round-trips the %s workspace without losing a poll path', tab => {
    const url = new URL(getPollTabRouteUrl(tab, { pathname: '/42', search: '?view=developers' }), 'https://example.test');
    expect(getCurrentPollRoute(url, {})).toEqual({ kind: 'workspace', tab });
    expect(url.pathname).toBe('/42');
  });
});
