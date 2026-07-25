import { responseData } from './pollFormat';
import { hasAction, qdnRequest } from './qdnRequest';

export type VoterIdentity = {
  address: string;
  avatarSrc: string | null;
  name: string | null;
};

const AVATAR_MAX_BYTES = 500 * 1024;
const AVATAR_RETRY_LIMIT = 3;
const AVATAR_FETCH_CONCURRENCY = 6;
const RESOLVE_IDENTITIES_LIMIT = 500;
const SAFE_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/webp']);
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

type AccountAvatarFetch =
  | { kind: 'pending'; retryAfterSeconds: number }
  | { kind: 'ready'; src: string }
  | { kind: 'unavailable' };

function normalizedName(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const name = (value as { name?: unknown }).name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function firstRegisteredName(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const entry of value) {
    const name = normalizedName(entry);

    if (name) {
      return name;
    }
  }

  return null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hasPointerDescriptor(value: unknown) {
  const descriptor = record(value);
  return !!text(descriptor?.service) && !!text(descriptor?.name) && typeof descriptor?.identifier === 'string';
}

function decodeBase64(value: string) {
  if (!value || !BASE64_PATTERN.test(value)) {
    return null;
  }

  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function parseAccountAvatar(value: unknown, expectedAddress: string): AccountAvatarFetch {
  const response = record(value);
  const source = response?.source;

  if (response?.address !== expectedAddress || (source !== 'POINTER' && source !== 'LEGACY')) {
    return { kind: 'unavailable' };
  }

  if (source === 'POINTER' && !hasPointerDescriptor(response.descriptor)) {
    return { kind: 'unavailable' };
  }

  if (response.status === 'PENDING') {
    const delay = typeof response.retryAfterSeconds === 'number' && Number.isFinite(response.retryAfterSeconds)
      ? response.retryAfterSeconds
      : 5;
    return { kind: 'pending', retryAfterSeconds: Math.min(Math.max(Math.floor(delay), 1), 30) };
  }

  if (response.encoding !== 'base64' || typeof response.body !== 'string' || typeof response.contentType !== 'string') {
    return { kind: 'unavailable' };
  }

  const contentType = response.contentType.toLowerCase().split(';', 1)[0];
  const contentLength = response.contentLength;
  const bytes = decodeBase64(response.body);

  if (
    !SAFE_IMAGE_MIME_TYPES.has(contentType) ||
    typeof contentLength !== 'number' ||
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > AVATAR_MAX_BYTES ||
    !bytes ||
    bytes.byteLength !== contentLength
  ) {
    return { kind: 'unavailable' };
  }

  return { kind: 'ready', src: URL.createObjectURL(new Blob([bytes.buffer], { type: contentType })) };
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchAccountAvatar(address: string, actions: string[], attempts = 0): Promise<string | null> {
  if (!hasAction(actions, 'FETCH_ACCOUNT_AVATAR')) {
    return null;
  }

  let result: AccountAvatarFetch;

  try {
    result = parseAccountAvatar(
      await qdnRequest<unknown>({ action: 'FETCH_ACCOUNT_AVATAR', address, maxBytes: AVATAR_MAX_BYTES }),
      address,
    );
  } catch {
    return null;
  }

  if (result.kind === 'ready') {
    return result.src;
  }

  if (result.kind === 'pending' && attempts < AVATAR_RETRY_LIMIT) {
    await delay(result.retryAfterSeconds * 1000);
    return fetchAccountAvatar(address, actions, attempts + 1);
  }

  return null;
}

async function loadName(address: string) {
  try {
    const primary = responseData<unknown>(await qdnRequest({
      action: 'FETCH_NODE_API',
      path: `/names/primary/${encodeURIComponent(address)}`,
      maxBytes: 64_000,
    }));
    const name = normalizedName(primary);

    if (name) {
      return name;
    }
  } catch {
    // Primary names are optional and older nodes may not expose this route.
  }

  try {
    const names = responseData<unknown>(await qdnRequest({
      action: 'FETCH_NODE_API',
      path: `/names/address/${encodeURIComponent(address)}?limit=0`,
      maxBytes: 256_000,
    }));

    return firstRegisteredName(names);
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(items: T[], resolve: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  await Promise.all(Array.from({ length: Math.min(AVATAR_FETCH_CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await resolve(items[index]);
    }
  }));

  return results;
}

async function loadFallbackIdentities(addresses: string[]) {
  return mapWithConcurrency(addresses, async (address) => ({ address, avatarSrc: null, name: await loadName(address) }));
}

async function loadBridgeIdentities(addresses: string[]) {
  const resolved: Array<{ address: string; name: string | null }> = [];

  for (let index = 0; index < addresses.length; index += RESOLVE_IDENTITIES_LIMIT) {
    const batch = await qdnRequest<unknown>({
      action: 'RESOLVE_IDENTITIES',
      addresses: addresses.slice(index, index + RESOLVE_IDENTITIES_LIMIT),
    });

    if (Array.isArray(batch)) {
      for (const entry of batch) {
        const candidate = record(entry);
        const address = text(candidate?.address);

        if (address) {
          resolved.push({ address, name: normalizedName(candidate) });
        }
      }
    }
  }

  const byAddress = new Map(resolved.map((identity) => [identity.address, identity]));
  return addresses.map((address) => {
    const identity = byAddress.get(address);
    return { address, avatarSrc: null, name: identity?.name ?? null };
  });
}

export function revokeVoterIdentityUrls(identities: ReadonlyMap<string, VoterIdentity>) {
  for (const identity of identities.values()) {
    if (identity.avatarSrc?.startsWith('blob:')) {
      URL.revokeObjectURL(identity.avatarSrc);
    }
  }
}

export async function loadVoterIdentities(addresses: string[], actions: string[]) {
  const unique = Array.from(new Set(addresses.map((address) => address.trim()).filter(Boolean)));

  if (!unique.length) {
    return new Map<string, VoterIdentity>();
  }

  let identities: VoterIdentity[];

  if (hasAction(actions, 'RESOLVE_IDENTITIES')) {
    try {
      identities = await loadBridgeIdentities(unique);
    } catch {
      identities = await loadFallbackIdentities(unique);
    }
  } else {
    identities = await loadFallbackIdentities(unique);
  }

  if (!hasAction(actions, 'FETCH_ACCOUNT_AVATAR')) {
    return new Map(identities.map((identity) => [identity.address, identity]));
  }

  const withAvatars = await mapWithConcurrency(identities, async (identity) => ({
    ...identity,
    avatarSrc: await fetchAccountAvatar(identity.address, actions),
  }));

  return new Map(withAvatars.map((identity) => [identity.address, identity]));
}
