const DEFAULT_SERVICE = 'APP';
const DEFAULT_NAME = 'Polls';
const DEFAULT_IDENTIFIER = 'Polls';
const MAX_POLL_ID = 2_147_483_647;

type LocationLike = {
  hash?: string;
  pathname?: string;
  search?: string;
};

type QdnHostGlobals = {
  _qdnBase?: unknown;
  _qdnIdentifier?: unknown;
  _qdnName?: unknown;
  _qdnPath?: unknown;
  _qdnService?: unknown;
};

export type InitialPollRoute =
  | { kind: 'none' }
  | { kind: 'invalid'; path: string }
  | { kind: 'poll'; pollId: number };

function resolveLocation(location?: LocationLike): LocationLike {
  if (location) {
    return location;
  }

  return typeof window === 'undefined' ? {} : window.location;
}

function resolveHost(host?: QdnHostGlobals): QdnHostGlobals {
  if (host) {
    return host;
  }

  return typeof window === 'undefined' ? {} : (window as Window & QdnHostGlobals);
}

function cleanGlobal(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getInitialPath(location?: LocationLike, host?: QdnHostGlobals) {
  const injectedPath = cleanGlobal(resolveHost(host)._qdnPath);

  if (injectedPath) {
    return injectedPath;
  }

  const pathname = resolveLocation(location).pathname ?? '';

  // Core injects _qdnPath for rendered apps. Do not guess which render segment
  // is the identifier when those globals are unexpectedly unavailable.
  return /^\/render\//i.test(pathname) ? '' : pathname;
}

function getBrowserPath(location?: LocationLike, host?: QdnHostGlobals) {
  const pathname = resolveLocation(location).pathname ?? '';
  const qdnBase = cleanGlobal(resolveHost(host)._qdnBase).replace(/\/+$/, '');

  if (qdnBase && (pathname === qdnBase || pathname.startsWith(`${qdnBase}/`))) {
    return pathname.slice(qdnBase.length);
  }

  return /^\/render\//i.test(pathname) ? '' : pathname;
}

export function parsePollRoute(path: string): InitialPollRoute {
  const routePath = path.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '');

  if (!routePath) {
    return { kind: 'none' };
  }

  if (!/^\d+$/.test(routePath)) {
    return { kind: 'invalid', path };
  }

  const pollId = Number(routePath);

  if (!Number.isSafeInteger(pollId) || pollId < 1 || pollId > MAX_POLL_ID) {
    return { kind: 'invalid', path };
  }

  return { kind: 'poll', pollId };
}

export function getInitialPollRoute(location?: LocationLike, host?: QdnHostGlobals) {
  return parsePollRoute(getInitialPath(location, host));
}

export function getCurrentPollRoute(location?: LocationLike, host?: QdnHostGlobals) {
  return parsePollRoute(getBrowserPath(location, host));
}

export function getPollRouteUrl(pollId: number | null, location?: LocationLike, host?: QdnHostGlobals) {
  const resolvedLocation = resolveLocation(location);
  const pathname = resolvedLocation.pathname ?? '/';
  const qdnBase = cleanGlobal(resolveHost(host)._qdnBase).replace(/\/+$/, '');
  const basePath = qdnBase || (/^\/(?:\d+)\/?$/.test(pathname) ? '' : pathname.replace(/\/+$/, ''));
  const routePath = pollId === null ? basePath || '/' : `${basePath}/${pollId}`;

  return `${routePath}${resolvedLocation.search ?? ''}${resolvedLocation.hash ?? ''}`;
}

export function getAppBaseAddress(host?: QdnHostGlobals) {
  const resolvedHost = resolveHost(host);
  const service = cleanGlobal(resolvedHost._qdnService) || DEFAULT_SERVICE;
  const name = cleanGlobal(resolvedHost._qdnName) || DEFAULT_NAME;
  const identifier = cleanGlobal(resolvedHost._qdnIdentifier) || DEFAULT_IDENTIFIER;

  return `qdn://${encodeURIComponent(service)}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

export function buildPollLink(pollId: number, host?: QdnHostGlobals) {
  return `${getAppBaseAddress(host)}/${pollId}`;
}
