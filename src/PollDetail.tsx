// Poll results and voting, with an optimistic pending-vote preview while the
// network records the vote.
import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, Vote } from 'lucide-react';
import { dateText, isClosed, isScheduled, stateKey, stateLabel } from './pollFormat';
import type { TranslateFunction, MessageKey } from './i18n';
import type { PendingVote, Poll, PollVotes } from './types';
import { Notice } from './ui';

type PollDetailProps = {
  account: string;
  busy: boolean;
  language: string;
  lockedNote: string;
  message: string;
  onBack: () => void;
  onRefresh: () => void;
  onVote: (indexes: number[]) => void;
  pendingVote: PendingVote | null;
  poll: Poll;
  supports142: boolean;
  translate: TranslateFunction;
  votes: PollVotes | null;
  writeAvailable: boolean;
};

const TRUST_KEYS: Record<string, MessageKey> = {
  GOLD: 'trust.gold',
  SILVER: 'trust.silver',
  BRONZE: 'trust.bronze',
  UNVERIFIED: 'trust.unverified',
  SUSPICIOUS: 'trust.suspicious',
};

export function PollDetail({
  account,
  busy,
  language,
  lockedNote,
  message,
  onBack,
  onRefresh,
  onVote,
  pendingVote,
  poll,
  supports142,
  translate,
  votes,
  writeAvailable,
}: PollDetailProps) {
  const [chosen, setChosen] = useState<number[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const mine = votes?.voteDetails?.find((vote) => vote.voterAddress === account)?.optionIndexes ?? [];
  const pendingForThis = pendingVote && pendingVote.pollId === poll.pollId ? pendingVote : null;
  const pendingActive = !!pendingForThis && (pendingForThis.phase === 'signing' || pendingForThis.phase === 'pending');
  // One vote can be in flight at a time, on any poll, so the watcher is never replaced.
  const voteLocked = !!pendingVote && (pendingVote.phase === 'signing' || pendingVote.phase === 'pending');
  const unavailable = !writeAvailable || isClosed(poll) || isScheduled(poll);
  const optionStats = poll.pollOptions.map((option, index) => {
    const oneBased = index + 1;
    let pendingDelta = 0;

    if (pendingActive && pendingForThis) {
      if (pendingForThis.indexes.includes(oneBased) && !mine.includes(oneBased)) {
        pendingDelta = 1;
      } else if (!pendingForThis.indexes.includes(oneBased) && mine.includes(oneBased)) {
        pendingDelta = -1;
      }
    }

    return {
      option: option.optionName,
      count: (votes?.voteCounts?.find((item) => item.optionName === option.optionName)?.voteCount ?? 0) + pendingDelta,
      effective: votes?.voteWeights?.find((item) => item.optionName === option.optionName)?.voteWeight ?? 0,
      raw: votes?.voteWeights?.find((item) => item.optionName === option.optionName)?.rawVoteWeight ?? 0,
      index: oneBased,
      pending: pendingDelta !== 0,
    };
  });
  const max = Math.max(1, ...optionStats.map((item) => showRaw ? item.raw : item.effective));
  const wasVoter = mine.length > 0;
  const isVoterAfter = pendingActive && pendingForThis ? pendingForThis.indexes.length > 0 : wasVoter;
  const totalVoters = (votes?.totalVoters ?? 0) + (isVoterAfter && !wasVoter ? 1 : !isVoterAfter && wasVoter ? -1 : 0);
  const totalVotes = (votes?.totalVotes ?? 0) + (pendingActive && pendingForThis ? pendingForThis.indexes.length - mine.length : 0);
  const shownSelection = pendingActive && pendingForThis ? pendingForThis.indexes : mine;
  const selectionNames = shownSelection
    .map((index) => poll.pollOptions[index - 1]?.optionName ?? `#${index}`)
    .join(', ');
  const sortedChosen = [...chosen].sort((a, b) => a - b);
  const sortedMine = [...mine].sort((a, b) => a - b);
  const sameAsStored = chosen.length > 0
    && sortedChosen.length === sortedMine.length
    && sortedChosen.every((value, index) => value === sortedMine[index]);

  function toggleChoice(index: number) {
    setChosen((current) => {
      if (!supports142) {
        return [index];
      }

      return current.includes(index) ? current.filter((item) => item !== index) : [...current, index];
    });
  }

  return (
    <main className="app-shell">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={17} />
        {translate('action.back')}
      </button>
      <section className="workspace detail">
        <header className="detail-heading">
          <div>
            <p className="eyebrow">
              {translate('label.poll', { id: poll.pollId })} · <span className={`pill pill--${stateKey(poll)}`}>{stateLabel(poll, translate)}</span>
            </p>
            <h1>{poll.pollName}</h1>
            <p>{poll.description || translate('label.noDescription')}</p>
          </div>
          <button className="icon-button" onClick={onRefresh} aria-label={translate('aria.refreshResults')}>
            <RefreshCw size={18} />
          </button>
        </header>

        {isClosed(poll) && <Notice>{translate('label.frozenResults')}</Notice>}
        {message && <Notice tone="error">{message}</Notice>}

        <div className="detail-grid">
          <section className="card results">
            <div className="section-heading">
              <h2>{translate('label.results')}</h2>
              <button className="minor-button" onClick={() => setShowRaw(!showRaw)}>
                {showRaw ? translate('vote.showEffective') : translate('vote.showRaw')}
              </button>
            </div>
            <p className="muted">
              {translate('label.optionSelections', {
                voters: totalVoters,
                votes: totalVotes,
              })}
            </p>
            {optionStats.map((item) => (
              <div className="result" key={item.index}>
                <div>
                  <strong>{item.index}. {item.option}</strong>
                  <span>
                    {translate('label.voteCount', { count: item.count })}
                    {' · '}{translate('label.effective', { count: item.effective })}
                    {' · '}{translate('label.raw', { count: item.raw })}
                  </span>
                </div>
                <div className={item.pending ? 'bar bar--pending' : 'bar'}>
                  <i style={{ width: `${((showRaw ? item.raw : item.effective) / max) * 100}%` }} />
                </div>
              </div>
            ))}
            {pendingActive && <p className="muted">{translate('label.weightsPending')}</p>}
          </section>

          <section className="card vote-panel">
            <h2>{translate('label.yourVote')}</h2>
            <p className="muted">{translate('vote.hint')}</p>
            {!supports142 && <Notice tone="warning">{translate('label.approvalVotingUnavailable')}</Notice>}
            {lockedNote && <Notice tone="warning">{lockedNote}</Notice>}
            {isScheduled(poll) && (
              <Notice tone="warning">
                {translate('vote.notStarted', { time: dateText(poll.startTime, language, translate('label.noStartTime')) })}
              </Notice>
            )}
            {isClosed(poll) && <Notice tone="warning">{translate('vote.closed')}</Notice>}
            <fieldset disabled={unavailable || busy || voteLocked}>
              {optionStats.map((item) => (
                <label className="choice" key={item.index}>
                  <input
                    type={supports142 ? 'checkbox' : 'radio'}
                    name="vote"
                    checked={(supports142 ? chosen : chosen.slice(0, 1)).includes(item.index)}
                    onChange={() => toggleChoice(item.index)}
                  />
                  {item.index}. {item.option}
                </label>
              ))}
            </fieldset>
            <p className="muted">
              {translate(pendingActive ? 'label.selectionPending' : 'label.selection', {
                selection: shownSelection.length ? selectionNames : translate('label.selectionNone'),
              })}
            </p>
            {sameAsStored && <small className="field-error" role="alert">{translate('vote.sameAsStored')}</small>}
            <button
              disabled={unavailable || busy || voteLocked || !chosen.length || sameAsStored}
              onClick={() => onVote(chosen)}
            >
              <Vote size={16} />
              {shownSelection.length ? translate('vote.change') : translate('action.vote')}
            </button>
            <button
              className="minor-button"
              disabled={unavailable || busy || voteLocked || !mine.length}
              onClick={() => onVote([])}
            >
              {translate('action.removeVote')}
            </button>
            {(busy || pendingActive) && (
              <p className="pending-status" role="status">
                <Loader2 size={15} className="spinner" />
                {translate(busy || pendingForThis?.phase === 'signing' ? 'status.vote.signing' : 'status.vote.pending')}
              </p>
            )}
            {pendingForThis?.phase === 'confirmed' && (
              <p className="pending-status pending-status--confirmed" role="status">
                <CheckCircle2 size={15} />
                {translate('status.vote.confirmed')}
              </p>
            )}
            {pendingForThis?.phase === 'timeout' && (
              <p className="pending-status pending-status--timeout" role="status">
                {translate('status.vote.timeout')}
              </p>
            )}
          </section>
        </div>

        <section className="card table-card">
          <h2>{translate('label.voteDetails')}</h2>
          <p className="muted">{translate('label.voteDetailsHint')}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{translate('label.voter')}</th>
                  <th>{translate('label.options')}</th>
                  <th>{translate('label.trust')}</th>
                  <th>{translate('label.rawWeight')}</th>
                  <th>{translate('label.effectiveWeight')}</th>
                </tr>
              </thead>
              <tbody>
                {votes?.voteDetails?.map((detail) => {
                  const trustKey = detail.trustStatus ? TRUST_KEYS[detail.trustStatus.toUpperCase()] : undefined;
                  const trustName = trustKey ? translate(trustKey) : detail.trustStatus ?? translate('label.unavailable');

                  return (
                    <tr key={detail.voterAddress}>
                      <td>{detail.voterAddress}</td>
                      <td>{detail.optionIndexes?.join(', ') ?? detail.optionIndex ?? translate('label.unavailable')}</td>
                      <td>
                        {detail.trustWeightPercent != null
                          ? translate('label.trustValue', { status: trustName, percent: detail.trustWeightPercent })
                          : trustName}
                      </td>
                      <td>{detail.rawVoteWeight ?? 0}</td>
                      <td>{detail.effectiveVoteWeight ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!votes?.voteDetails?.length && <p className="muted">{translate('label.noVoteDetails')}</p>}
        </section>
      </section>
    </main>
  );
}
