import { describe, expect, it } from 'vitest';
import { getPollWriteAvailability } from './writeAvailability';

const pollActions = ['CREATE_POLL', 'VOTE_ON_POLL', 'UPDATE_POLL'];

describe('poll write availability', () => {
  it('enables compatible public-node writes and marks them for local-signing guidance', () => {
    expect(getPollWriteAvailability(pollActions, true)).toEqual({
      available: true,
      publicSigning: true,
    });
  });

  it('keeps older public nodes browse-only when any builder action is absent', () => {
    expect(getPollWriteAvailability(['CREATE_POLL', 'VOTE_ON_POLL'], true)).toEqual({
      available: false,
      publicSigning: false,
    });
  });
});
