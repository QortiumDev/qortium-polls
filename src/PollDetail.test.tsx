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
    voterIdentities={new Map()}
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

  it('shows a voter name and avatar while retaining the address as context', () => {
    const namedVotes: PollVotes = {
      ...votes,
      voteDetails: [{ voterAddress: 'Qalice', optionIndexes: [1], rawVoteWeight: 1, effectiveVoteWeight: 1 }],
    };
    const markup = renderDetail({
      votes: namedVotes,
      votesLoading: false,
      voterIdentities: new Map([[
        'Qalice',
        { address: 'Qalice', avatarSrc: 'https://node.test/avatar', name: 'Alice' },
      ]]),
    });

    expect(markup).toContain('src="https://node.test/avatar"');
    expect(markup).toContain('<strong>Alice</strong>');
    expect(markup).toContain('title="Qalice"');
    expect(markup).not.toContain('<td>Qalice</td>');
  });

  it('falls back to the voter address when no identity is registered', () => {
    const anonymousVotes: PollVotes = {
      ...votes,
      voteDetails: [{ voterAddress: 'Qanonymous', optionIndexes: [2] }],
    };
    const markup = renderDetail({ votes: anonymousVotes, votesLoading: false });

    expect(markup).toContain('class="voter-address"');
    expect(markup).toContain('>Qanonymous</span>');
  });
});
