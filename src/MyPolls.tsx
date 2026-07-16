// Demonstrates owner filtering and the owner-only UPDATE_POLL transaction flow.
import { useState } from 'react';
import { EditPoll } from './EditPoll';
import { isClosed, stateLabel } from './pollFormat';
import type { TranslateFunction } from './i18n';
import type { Poll } from './types';
import { Notice } from './ui';

type MyPollsProps = {
  account: string;
  busy: boolean;
  language: string;
  loading: boolean;
  lockedNote: string;
  onOpen: (poll: Poll) => void;
  onUpdate: (request: Record<string, unknown>) => void;
  polls: Poll[];
  supports142: boolean;
  translate: TranslateFunction;
  writeAvailable: boolean;
};

export function MyPolls({
  account,
  busy,
  language,
  loading,
  lockedNote,
  onOpen,
  onUpdate,
  polls,
  supports142,
  translate,
  writeAvailable,
}: MyPollsProps) {
  const [editing, setEditing] = useState<Poll | null>(null);

  if (!account) {
    return <section className="workspace"><Notice tone="warning">{translate('node.selectAccount')}</Notice></section>;
  }

  if (editing) {
    return (
      <EditPoll
        poll={editing}
        language={language}
        supports142={supports142}
        writeAvailable={writeAvailable}
        lockedNote={lockedNote}
        busy={busy}
        translate={translate}
        onCancel={() => setEditing(null)}
        onSubmit={onUpdate}
      />
    );
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <h2>{translate('tab.mine')}</h2>
          <p>{account}</p>
        </div>
      </div>
      {lockedNote && <Notice tone="warning">{lockedNote}</Notice>}
      {loading ? (
        <div className="empty-state">{translate('label.loadingMyPolls')}</div>
      ) : (
        <div className="poll-list">
          {polls.map((poll) => (
            <article className="poll-row card" key={poll.pollId}>
              <div>
                <strong>{poll.pollName}</strong>
                <span>{stateLabel(poll, translate)} · {translate('label.optionCount', { count: poll.pollOptions.length })}</span>
              </div>
              <div className="inline-actions">
                <button className="minor-button" onClick={() => onOpen(poll)}>{translate('action.view')}</button>
                <button disabled={!writeAvailable || isClosed(poll)} onClick={() => setEditing(poll)}>{translate('action.manage')}</button>
              </div>
            </article>
          ))}
          {!polls.length && <div className="empty-state">{translate('empty.myPolls')}</div>}
        </div>
      )}
    </section>
  );
}
