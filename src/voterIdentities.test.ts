import { beforeEach, describe, expect, it, vi } from 'vitest';
import { qdnRequest } from './qdnRequest';
import { loadVoterIdentities, revokeVoterIdentityUrls } from './voterIdentities';

vi.mock('./qdnRequest', () => ({
  hasAction: (actions: string[], ...candidates: string[]) => {
    const available = new Set(actions.map((action) => action.toUpperCase()));
    return candidates.some((candidate) => available.has(candidate.toUpperCase()));
  },
  qdnRequest: vi.fn(),
}));

describe('voter identity loading', () => {
  const qdnRequestMock = vi.mocked(qdnRequest);
  const createObjectURLMock = vi.fn((blob: Blob) => `blob:mock/${blob.type}`);
  const revokeObjectURLMock = vi.fn();

  beforeEach(() => {
    qdnRequestMock.mockReset();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    (URL as unknown as { createObjectURL: typeof createObjectURLMock }).createObjectURL = createObjectURLMock;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectURLMock }).revokeObjectURL = revokeObjectURLMock;
  });

  it('dedupes and chunks name-only Home identity requests at 500 addresses', async () => {
    const addresses = Array.from({ length: 501 }, (_value, index) => `Q${index}`);
    qdnRequestMock.mockImplementation(async (request) => {
      const batch = request.addresses as string[];
      return batch.map((address) => ({ address, avatarSrc: `https://node.test/${address}/avatar`, name: `name-${address}` }));
    });

    const identities = await loadVoterIdentities([...addresses, 'Q0'], ['RESOLVE_IDENTITIES']);

    expect(identities).toHaveLength(501);
    expect(identities.get('Q0')).toEqual({ address: 'Q0', avatarSrc: null, name: 'name-Q0' });
    expect(qdnRequestMock).toHaveBeenCalledTimes(2);
    expect(qdnRequestMock.mock.calls[0][0].addresses).toHaveLength(500);
    expect(qdnRequestMock.mock.calls[1][0].addresses).toEqual(['Q500']);
  });

  it('uses a pointer-aware Blob avatar without trusting the legacy avatarSrc hint', async () => {
    qdnRequestMock
      .mockResolvedValueOnce([{ address: 'Qalice', avatarSrc: 'https://node.test/legacy', name: 'Alice' }])
      .mockResolvedValueOnce({
        address: 'Qalice', body: 'iVBORw0KGgo=', contentLength: 8, contentType: 'image/png',
        descriptor: { identifier: 'avatar', name: 'alice', service: 'THUMBNAIL' }, encoding: 'base64', source: 'POINTER',
      });

    const identities = await loadVoterIdentities(['Qalice'], ['RESOLVE_IDENTITIES', 'FETCH_ACCOUNT_AVATAR']);

    expect(identities.get('Qalice')).toEqual({ address: 'Qalice', avatarSrc: 'blob:mock/image/png', name: 'Alice' });
    expect(qdnRequestMock).toHaveBeenLastCalledWith({ action: 'FETCH_ACCOUNT_AVATAR', address: 'Qalice', maxBytes: 500 * 1024 });
  });

  it('keeps browser fallback name-only and makes no avatar request', async () => {
    qdnRequestMock.mockResolvedValueOnce({ data: { name: 'Primary' }, ok: true });

    const identities = await loadVoterIdentities(['Qprimary'], []);

    expect(identities.get('Qprimary')).toEqual({ address: 'Qprimary', avatarSrc: null, name: 'Primary' });
    expect(qdnRequestMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { address: 'Qother', body: 'iVBORw0KGgo=', contentLength: 8, contentType: 'image/png', descriptor: null, encoding: 'base64', source: 'LEGACY' },
    { address: 'Qalice', body: 'broken', contentLength: 8, contentType: 'image/png', descriptor: null, encoding: 'base64', source: 'LEGACY' },
    { address: 'Qalice', body: 'iVBORw0KGgo=', contentLength: 8, contentType: 'image/svg+xml', descriptor: null, encoding: 'base64', source: 'LEGACY' },
  ])('fails closed for malformed avatar responses', async (avatarResponse) => {
    qdnRequestMock.mockResolvedValueOnce([{ address: 'Qalice', name: 'Alice' }]).mockResolvedValueOnce(avatarResponse);

    const identities = await loadVoterIdentities(['Qalice'], ['RESOLVE_IDENTITIES', 'FETCH_ACCOUNT_AVATAR']);

    expect(identities.get('Qalice')).toEqual({ address: 'Qalice', avatarSrc: null, name: 'Alice' });
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it('retries only an explicit pending avatar response', async () => {
    vi.useFakeTimers();
    qdnRequestMock
      .mockResolvedValueOnce([{ address: 'Qalice', name: 'Alice' }])
      .mockResolvedValueOnce({
        address: 'Qalice', descriptor: { identifier: 'avatar', name: 'alice', service: 'THUMBNAIL' },
        retryAfterSeconds: 1, source: 'POINTER', status: 'PENDING',
      })
      .mockResolvedValueOnce({
        address: 'Qalice', body: 'iVBORw0KGgo=', contentLength: 8, contentType: 'image/png',
        descriptor: { identifier: 'avatar', name: 'alice', service: 'THUMBNAIL' }, encoding: 'base64', source: 'POINTER',
      });

    const pending = loadVoterIdentities(['Qalice'], ['RESOLVE_IDENTITIES', 'FETCH_ACCOUNT_AVATAR']);
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject(new Map([[
      'Qalice', { address: 'Qalice', avatarSrc: 'blob:mock/image/png', name: 'Alice' },
    ]]));
    expect(qdnRequestMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('revokes only loaded Blob URLs', () => {
    revokeVoterIdentityUrls(new Map([
      ['Qalice', { address: 'Qalice', avatarSrc: 'blob:mock/image/png', name: 'Alice' }],
      ['Qbob', { address: 'Qbob', avatarSrc: 'https://node.test/avatar', name: 'Bob' }],
    ]));

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock/image/png');
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
  });
});
