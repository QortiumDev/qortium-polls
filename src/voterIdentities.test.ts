import { beforeEach, describe, expect, it, vi } from 'vitest';
import { qdnRequest } from './qdnRequest';
import { loadVoterIdentities } from './voterIdentities';

vi.mock('./qdnRequest', () => ({
  getNodeApiUrl: () => 'http://127.0.0.1:24891',
  hasAction: (actions: string[], ...candidates: string[]) => {
    const available = new Set(actions.map((action) => action.toUpperCase()));
    return candidates.some((candidate) => available.has(candidate.toUpperCase()));
  },
  qdnRequest: vi.fn(),
}));

describe('voter identity loading', () => {
  const qdnRequestMock = vi.mocked(qdnRequest);

  beforeEach(() => {
    qdnRequestMock.mockReset();
  });

  it('dedupes and chunks Home identity requests at 500 addresses', async () => {
    const addresses = Array.from({ length: 501 }, (_value, index) => `Q${index}`);
    qdnRequestMock.mockImplementation(async (request) => {
      const batch = request.addresses as string[];
      return batch.map((address) => ({
        address,
        avatarSrc: `https://node.test/${address}/avatar`,
        name: `name-${address}`,
      }));
    });

    const identities = await loadVoterIdentities([...addresses, 'Q0'], ['RESOLVE_IDENTITIES']);

    expect(identities).toHaveLength(501);
    expect(identities.get('Q0')).toEqual({
      address: 'Q0',
      avatarSrc: 'https://node.test/Q0/avatar',
      name: 'name-Q0',
    });
    expect(qdnRequestMock).toHaveBeenCalledTimes(2);
    expect(qdnRequestMock.mock.calls[0][0].addresses).toHaveLength(500);
    expect(qdnRequestMock.mock.calls[1][0].addresses).toEqual(['Q500']);
  });

  it('prefers a primary name in the fallback path', async () => {
    qdnRequestMock.mockResolvedValueOnce({ data: { name: 'Primary' }, ok: true });

    const identities = await loadVoterIdentities(['Qprimary'], []);

    expect(identities.get('Qprimary')).toEqual({
      address: 'Qprimary',
      avatarSrc: 'http://127.0.0.1:24891/arbitrary/THUMBNAIL/Primary/avatar?async=true',
      name: 'Primary',
    });
    expect(qdnRequestMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the first registered name in API order', async () => {
    qdnRequestMock
      .mockResolvedValueOnce({ data: null, ok: true })
      .mockResolvedValueOnce({ data: [{ name: 'First' }, { name: 'Second' }], ok: true });

    const identities = await loadVoterIdentities(['Qfirst'], []);

    expect(identities.get('Qfirst')?.name).toBe('First');
    expect(qdnRequestMock.mock.calls[1][0].path).toBe('/names/address/Qfirst?limit=0');
  });

  it('keeps an address-only fallback when no name resolves', async () => {
    qdnRequestMock
      .mockRejectedValueOnce(new Error('primary unavailable'))
      .mockResolvedValueOnce({ data: [], ok: true });

    await expect(loadVoterIdentities(['Qanonymous'], [])).resolves.toEqual(new Map([[
      'Qanonymous',
      { address: 'Qanonymous', avatarSrc: null, name: null },
    ]]));
  });
});
