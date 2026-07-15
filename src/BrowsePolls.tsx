// Demonstrates Core's public poll-search endpoint and its paging/filter contract.
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { dateText, stateLabel } from './pollFormat';
import type { TranslateFunction } from './i18n';
import type { Poll } from './types';

export const POLL_PAGE_SIZE = 20;

type BrowsePollsProps = {
  language: string;
  loading: boolean;
  offset: number;
  onOpen: (poll: Poll) => void;
  onOwner: (value: string) => void;
  onPage: (value: number) => void;
  onQuery: (value: string) => void;
  onReverse: (value: boolean) => void;
  onSearch: (event: FormEvent) => void;
  onStatus: (value: string) => void;
  owner: string;
  polls: Poll[];
  query: string;
  reverse: boolean;
  status: string;
  translate: TranslateFunction;
};

export function BrowsePolls({
  language,
  loading,
  offset,
  onOpen,
  onOwner,
  onPage,
  onQuery,
  onReverse,
  onSearch,
  onStatus,
  owner,
  polls,
  query,
  reverse,
  status,
  translate,
}: BrowsePollsProps) {
  return (
    <section className="workspace">
      <form className="filters card" onSubmit={onSearch}>
        <label>
          {translate('field.search')}
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={translate('placeholder.search')}
          />
        </label>
        <label>
          {translate('field.ownerAddress')}
          <input
            value={owner}
            onChange={(event) => onOwner(event.target.value)}
            placeholder={translate('placeholder.owner')}
          />
        </label>
        <label>
          {translate('field.status')}
          <select value={status} onChange={(event) => onStatus(event.target.value)}>
            <option value="OPEN">{translate('filter.open')}</option>
            <option value="CLOSED">{translate('filter.closed')}</option>
            <option value="ALL">{translate('filter.all')}</option>
          </select>
        </label>
        <label>
          {translate('field.sort')}
          <select value={String(reverse)} onChange={(event) => onReverse(event.target.value === 'true')}>
            <option value="true">{translate('sort.newest')}</option>
            <option value="false">{translate('sort.oldest')}</option>
          </select>
        </label>
        <button type="submit">{translate('action.search')}</button>
      </form>

      {loading ? (
        <div className="empty-state">
          <Loader2 className="spinner" />
          {translate('label.loadingPolls')}
        </div>
      ) : (
        <div className="poll-list">
          {polls.map((poll) => {
            const pollState = stateLabel(poll, translate);

            return (
              <button className="poll-row card" key={poll.pollId} onClick={() => onOpen(poll)}>
                <div>
                  <strong>{poll.pollName}</strong>
                  <span>{translate('label.options')} {poll.pollOptions.length} · {poll.owner}</span>
                </div>
                <div className="row-meta">
                  <span className={`pill pill--${pollState.toLowerCase()}`}>{pollState}</span>
                  <small>{dateText(poll.endTime, language, translate('label.noEndTime'))}</small>
                </div>
              </button>
            );
          })}
          {!polls.length && <div className="empty-state">{translate('empty.polls')}</div>}
        </div>
      )}

      <div className="pager">
        <button disabled={!offset} onClick={() => onPage(offset - POLL_PAGE_SIZE)}>
          {translate('action.previous')}
        </button>
        <span>{translate('time.offset', { offset })}</span>
        <button disabled={polls.length < POLL_PAGE_SIZE} onClick={() => onPage(offset + POLL_PAGE_SIZE)}>
          {translate('action.next')}
        </button>
      </div>
    </section>
  );
}
