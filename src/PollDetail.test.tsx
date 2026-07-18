import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createTranslator } from './i18n';
import { PollDetail } from './PollDetail';
import type { Poll, PollVotes } from './types';

const translate = createTranslator('en');
const poll: Poll = {
  pollId: 42,
  pollName: 'Loading-state poll',
  owner: 'Qowner',
  pollOptions: [{ optionName: 'Yes' }, { optionName: 'No' }],
};
const votes: PollVotes = {
  totalVoters: 2,
  totalVotes: 3,
  voteCounts: [
    { optionName: 'Yes', voteCount: 2 },
    { optionName: 'No', voteCount: 1 },
  ],
  voteDetails: [],
  voteWeights: [],
};

function renderDetail(overrides: Partial<Parameters<typeof PollDetail>[0]> = {}) {
  return renderToStaticMarkup(<PollDetail
    account=""
    busy={false}
    language="en"
    lockedNote=""
    message=""
    onBack={() => undefined}
    onRefresh={() => undefined}
    onVote={() => undefined}
    pendingVote={null}
    poll={poll}
    shareAddress="qdn://APP/Polls/Polls/42"
    supports142
    translate={translate}
    votes={null}
    votesLoading
    writeAvailable
    {...overrides}
  />);
}

describe('poll result loading states', () => {
  it('does not render pending results as authoritative zeroes', () => {
    const markup = renderDetail();

    expect(markup).toContain('Loading results…');
    expect(markup).not.toContain('0 people voted');
    expect(markup).not.toContain('No votes yet.');
    expect(markup).toContain('<fieldset disabled="">');
  });

  it('preserves confirmed results while refreshing them', () => {
    const markup = renderDetail({ votes, votesLoading: true });

    expect(markup).toContain('Loading results…');
    expect(markup).toContain('2 people voted, choosing 3 options in total.');
    expect(markup).toContain('2 votes');
  });

  it('shows a genuine zero only after results resolve', () => {
    const markup = renderDetail({ votes: { totalVoters: 0, totalVotes: 0 }, votesLoading: false });

    expect(markup).toContain('0 people voted, choosing 0 options in total.');
    expect(markup).toContain('No votes yet.');
    expect(markup).not.toContain('Loading results…');
  });
});
