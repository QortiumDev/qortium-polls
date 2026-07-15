// Demonstrates Core's result endpoint, 1-based vote indexes, and mutable approval votes.
import { useState } from 'react';
import { ArrowLeft, RefreshCw, Vote } from 'lucide-react';
import { dateText, isClosed, isScheduled, stateLabel } from './pollFormat';
import type { TranslateFunction } from './i18n';
import type { Poll, PollVotes } from './types';
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
  poll: Poll;
  supports142: boolean;
  translate: TranslateFunction;
  votes: PollVotes | null;
  writeAvailable: boolean;
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
  poll,
  supports142,
  translate,
  votes,
  writeAvailable,
}: PollDetailProps) {
  const [chosen, setChosen] = useState<number[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const mine = votes?.voteDetails?.find((vote) => vote.voterAddress === account)?.optionIndexes ?? [];
  const unavailable = !writeAvailable || isClosed(poll) || isScheduled(poll);
  const pollState = stateLabel(poll, translate);
  const optionStats = poll.pollOptions.map((option, index) => ({
    option: option.optionName,
    count: votes?.voteCounts?.find((item) => item.optionName === option.optionName)?.voteCount ?? 0,
    effective: votes?.voteWeights?.find((item) => item.optionName === option.optionName)?.voteWeight ?? 0,
    raw: votes?.voteWeights?.find((item) => item.optionName === option.optionName)?.rawVoteWeight ?? 0,
    index: index + 1,
  }));
  const max = Math.max(1, ...optionStats.map((item) => showRaw ? item.raw : item.effective));

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
              {translate('label.poll', { id: poll.pollId })} · <span className={`pill pill--${pollState.toLowerCase()}`}>{pollState}</span>
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
                voters: votes?.totalVoters ?? 0,
                votes: votes?.totalVotes ?? 0,
              })}
            </p>
            {optionStats.map((item) => (
              <div className="result" key={item.index}>
                <div>
                  <strong>{item.index}. {item.option}</strong>
                  <span>{item.count} · {translate('label.effective', { count: item.effective })} · {translate('label.raw', { count: item.raw })}</span>
                </div>
                <div className="bar">
                  <i style={{ width: `${((showRaw ? item.raw : item.effective) / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </section>

          <section className="card vote-panel">
            <h2>{translate('label.yourVote')}</h2>
            <p className="muted">{translate('vote.hint')}</p>
            {!supports142 && <Notice tone="warning">{translate('label.approvalVotingUnavailable')}</Notice>}
            {lockedNote && <Notice tone="warning">{lockedNote}</Notice>}
            {isScheduled(poll) && (
              <Notice tone="warning">
                {translate('vote.notStarted', { time: dateText(poll.startTime, language, translate('label.noEndTime')) })}
              </Notice>
            )}
            {isClosed(poll) && <Notice tone="warning">{translate('vote.closed')}</Notice>}
            <fieldset disabled={unavailable || busy}>
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
            <p className="muted">{translate('label.selection', { selection: mine.length ? mine.join(', ') : translate('label.selectionNone') })}</p>
            <button disabled={unavailable || busy || !chosen.length} onClick={() => onVote(chosen)}>
              <Vote size={16} />
              {mine.length ? translate('vote.change') : translate('action.vote')}
            </button>
            <button className="minor-button" disabled={unavailable || busy || !mine.length} onClick={() => onVote([])}>
              {translate('action.removeVote')}
            </button>
          </section>
        </div>

        <section className="card table-card">
          <h2>{translate('label.voteDetails')}</h2>
          <p className="muted">{translate('label.voteDetailsHint')}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{translate('label.owner')}</th>
                  <th>{translate('label.options')}</th>
                  <th>{translate('label.trust')}</th>
                  <th>{translate('label.rawWeight')}</th>
                  <th>{translate('label.effectiveWeight')}</th>
                </tr>
              </thead>
              <tbody>
                {votes?.voteDetails?.map((detail) => (
                  <tr key={detail.voterAddress}>
                    <td>{detail.voterAddress}</td>
                    <td>{detail.optionIndexes?.join(', ') ?? detail.optionIndex ?? translate('label.unavailable')}</td>
                    <td>{detail.trustStatus ?? translate('label.unavailable')} {detail.trustWeightPercent != null ? `(${detail.trustWeightPercent}%)` : ''}</td>
                    <td>{detail.rawVoteWeight ?? 0}</td>
                    <td>{detail.effectiveVoteWeight ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!votes?.voteDetails?.length && <p className="muted">{translate('label.noVoteDetails')}</p>}
        </section>
      </section>
    </main>
  );
}
