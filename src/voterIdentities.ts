import { responseData } from './pollFormat';
import { getNodeApiUrl, hasAction, qdnRequest } from './qdnRequest';

export type VoterIdentity = {
  address: string;
  avatarSrc: string | null;
  name: string | null;
};

const RESOLVE_IDENTITIES_LIMIT = 500;
const FALLBACK_CONCURRENCY = 6;

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

async function loadAvatarSrc(name: string, actions: string[]) {
  if (hasAction(actions, 'GET_QDN_RESOURCE_URL')) {
    try {
      const renderUrl = await qdnRequest<unknown>({
        action: 'GET_QDN_RESOURCE_URL',
        service: 'THUMBNAIL',
        name,
        identifier: 'avatar',
      });

      return typeof renderUrl === 'string' && renderUrl ? renderUrl : null;
    } catch {
      return null;
    }
  }

  return `${getNodeApiUrl()}/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/avatar?async=true`;
}

async function loadIdentity(address: string, actions: string[]): Promise<VoterIdentity> {
  const name = await loadName(address);

  return {
    address,
    avatarSrc: name ? await loadAvatarSrc(name, actions) : null,
    name,
  };
}

async function loadFallbackIdentities(addresses: string[], actions: string[]) {
  const results = new Array<VoterIdentity>(addresses.length);
  let cursor = 0;

  await Promise.all(Array.from({ length: Math.min(FALLBACK_CONCURRENCY, addresses.length) }, async () => {
    while (cursor < addresses.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await loadIdentity(addresses[index], actions);
    }
  }));

  return results;
}

async function loadBridgeIdentities(addresses: string[]) {
  const resolved: VoterIdentity[] = [];

  for (let index = 0; index < addresses.length; index += RESOLVE_IDENTITIES_LIMIT) {
    const batch = await qdnRequest<unknown>({
      action: 'RESOLVE_IDENTITIES',
      addresses: addresses.slice(index, index + RESOLVE_IDENTITIES_LIMIT),
    });

    if (Array.isArray(batch)) {
      for (const entry of batch) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          continue;
        }

        const record = entry as { address?: unknown; avatarSrc?: unknown; name?: unknown };
        const address = typeof record.address === 'string' ? record.address.trim() : '';

        if (!address) {
          continue;
        }

        const name = normalizedName(record);
        resolved.push({
          address,
          avatarSrc: name && typeof record.avatarSrc === 'string' && record.avatarSrc ? record.avatarSrc : null,
          name,
        });
      }
    }
  }

  const byAddress = new Map(resolved.map((identity) => [identity.address, identity]));
  return addresses.map((address) => byAddress.get(address) ?? { address, avatarSrc: null, name: null });
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
      identities = await loadFallbackIdentities(unique, actions);
    }
  } else {
    identities = await loadFallbackIdentities(unique, actions);
  }

  return new Map(identities.map((identity) => [identity.address, identity]));
}
