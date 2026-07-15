// Demonstrates UPDATE_POLL's owner-only full replacement and post-vote end-time extension rule.
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  fromDateInput,
  isClosed,
  isUnchangedDateInput,
  preservedDateInputValue,
  responseData,
  toDateInput,
} from './pollFormat';
import { validatePollFields } from './pollValidation';
import { qdnRequest } from './qdnRequest';
import type { TranslateFunction } from './i18n';
import type { Poll, PollVotes } from './types';
import { Notice } from './ui';

type EditPollProps = {
  busy: boolean;
  lockedNote: string;
  onCancel: () => void;
  onSubmit: (request: Record<string, unknown>) => void;
  poll: Poll;
  supports142: boolean;
  translate: TranslateFunction;
  writeAvailable: boolean;
};

export function EditPoll({
  busy,
  lockedNote,
  onCancel,
  onSubmit,
  poll,
  supports142,
  translate,
  writeAvailable,
}: EditPollProps) {
  const [name, setName] = useState(poll.pollName);
  const [description, setDescription] = useState(poll.description ?? '');
  const [options, setOptions] = useState(poll.pollOptions.map((item) => item.optionName));
  const [start, setStart] = useState(toDateInput(poll.startTime));
  const [end, setEnd] = useState(toDateInput(poll.endTime));
  const [hasVotes, setHasVotes] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    void qdnRequest({
      action: 'FETCH_NODE_API',
      path: `/polls/votes/id/${poll.pollId}?onlyCounts=true`,
    }).then((value) => {
      const data = responseData<PollVotes>(value);

      if (active) {
        setHasVotes((data.totalVoters ?? 0) > 0);
      }
    }).catch(() => {
      if (active) {
        setHasVotes(null);
      }
    });

    return () => {
      active = false;
    };
  }, [poll.pollId]);

  const startUnchanged = isUnchangedDateInput(start, poll.startTime);
  const validation = validatePollFields({
    name,
    description,
    options,
    startTime: startUnchanged ? undefined : fromDateInput(start),
    endTime: fromDateInput(end),
    now: Date.now(),
  });
  const extensionOnly = hasVotes === true && (!poll.endTime || !fromDateInput(end) || fromDateInput(end)! <= poll.endTime);
  const oldHostScheduled = !!poll.startTime && !supports142;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validation.ok || extensionOnly || oldHostScheduled) {
      return;
    }

    onSubmit({
      pollId: poll.pollId,
      newPollName: name,
      newDescription: description,
      newPollOptions: options,
      ...(supports142 ? { newStartTime: preservedDateInputValue(start, poll.startTime) } : {}),
      newEndTime: fromDateInput(end),
    });
  }

  return (
    <section className="workspace form-page">
      <button className="back-button" onClick={onCancel}>
        <ArrowLeft size={17} />
        {translate('tab.mine')}
      </button>
      <h2>{translate('poll.manage', { name: poll.pollName })}</h2>
      <Notice tone="warning">{translate('poll.ownerRule')}</Notice>
      {lockedNote && <Notice tone="warning">{lockedNote}</Notice>}
      {hasVotes === null && <Notice>{translate('label.checkingVotes')}</Notice>}
      {oldHostScheduled && <Notice tone="warning">{translate('node.oldHostScheduled')}</Notice>}
      <form className="card form-card" onSubmit={submit}>
        <label>
          {translate('field.name')}
          <input disabled={hasVotes === true} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          {translate('field.description')}
          <textarea disabled={hasVotes === true} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        {options.map((option, index) => (
          <label key={index}>
            {translate('label.option', { number: index + 1 })}
            <input
              disabled={hasVotes === true}
              value={option}
              onChange={(event) => setOptions((current) => current.map((old, currentIndex) => currentIndex === index ? event.target.value : old))}
            />
          </label>
        ))}
        {supports142 && (
          <label>
            {translate('field.startTime')}
            <input disabled={hasVotes === true} type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
        )}
        <label>
          {translate('field.endTime')}
          <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
        {extensionOnly && <Notice tone="error">{translate('poll.votedEndRule')}</Notice>}
        {!validation.ok && <Notice tone="error">{validation.code}</Notice>}
        <button disabled={!writeAvailable || busy || hasVotes === null || !validation.ok || extensionOnly || oldHostScheduled || isClosed(poll)} type="submit">
          {translate('action.save')}
        </button>
      </form>
    </section>
  );
}
