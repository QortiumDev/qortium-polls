import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  dateText,
  fromDateInput,
  isClosed,
  isUnchangedDateInput,
  minDateInput,
  preservedDateInputValue,
  responseData,
  toDateInput,
} from './pollFormat';
import { pollFieldErrors, POLL_LIMITS, validatePollFields } from './pollValidation';
import { qdnRequest } from './qdnRequest';
import type { TranslateFunction } from './i18n';
import type { Poll, PollVotes } from './types';
import { ByteHelp, FieldMessage, Notice } from './ui';

type EditPollProps = {
  busy: boolean;
  language: string;
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
  language,
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);

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
  const fieldInput = {
    name,
    description,
    options,
    startTime: startUnchanged ? undefined : fromDateInput(start),
    endTime: fromDateInput(end),
    now: Date.now(),
  };
  const validation = validatePollFields(fieldInput);
  const errors = pollFieldErrors(fieldInput);
  const extensionOnly = hasVotes === true && (!poll.endTime || !fromDateInput(end) || fromDateInput(end)! <= poll.endTime);
  const oldHostScheduled = !!poll.startTime && !supports142;
  const locked = hasVotes === true;

  function touch(field: string) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function shows(field: string) {
    return attempted || !!touched[field];
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fresh = validatePollFields({ ...fieldInput, now: Date.now() });

    if (!fresh.ok || extensionOnly || oldHostScheduled) {
      setAttempted(true);
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
      <form className="card form-card" onSubmit={submit} noValidate>
        <label>
          {translate('field.name')}
          <input
            disabled={locked}
            value={name}
            maxLength={POLL_LIMITS.maxNameBytes}
            aria-invalid={shows('name') && !!errors.name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => touch('name')}
          />
          {!locked && <ByteHelp value={name} max={POLL_LIMITS.maxNameBytes} translate={translate} />}
          <FieldMessage error={shows('name') && errors.name} translate={translate} />
        </label>
        <label>
          {translate('field.description')}
          <textarea
            disabled={locked}
            value={description}
            maxLength={POLL_LIMITS.maxDescriptionBytes}
            aria-invalid={shows('description') && !!errors.description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => touch('description')}
          />
          {!locked && <ByteHelp value={description} max={POLL_LIMITS.maxDescriptionBytes} translate={translate} />}
          <FieldMessage error={shows('description') && errors.description} translate={translate} />
        </label>
        {options.map((option, index) => (
          <label key={index}>
            {translate('label.option', { number: index + 1 })}
            <input
              disabled={locked}
              value={option}
              maxLength={POLL_LIMITS.maxOptionBytes}
              aria-invalid={shows(`option-${index}`) && !!errors.options[index]}
              onChange={(event) => setOptions((current) => current.map((old, currentIndex) => currentIndex === index ? event.target.value : old))}
              onBlur={() => touch(`option-${index}`)}
            />
            <FieldMessage error={shows(`option-${index}`) && errors.options[index]} translate={translate} />
          </label>
        ))}
        {supports142 && (
          <label>
            {translate('field.startTime')}
            <input
              disabled={locked}
              type="datetime-local"
              value={start}
              aria-invalid={shows('start') && !!errors.start}
              onChange={(event) => setStart(event.target.value)}
              onBlur={() => touch('start')}
            />
            <FieldMessage error={shows('start') && errors.start} translate={translate} />
          </label>
        )}
        <label>
          {translate('field.endTime')}
          <input
            type="datetime-local"
            value={end}
            min={locked ? minDateInput(Math.max(Date.now(), poll.endTime ?? 0)) : minDateInput()}
            aria-invalid={shows('end') && !!(errors.end || (extensionOnly && hasVotes === true))}
            onChange={(event) => setEnd(event.target.value)}
            onBlur={() => touch('end')}
          />
          <FieldMessage error={shows('end') && errors.end} translate={translate} />
          {extensionOnly && (
            <small className="field-error" role="alert">
              {translate('edit.endExtendOnly', { time: dateText(poll.endTime, language, translate('label.noEndTime')) })}
            </small>
          )}
        </label>
        {attempted && !validation.ok && <Notice tone="error">{translate('error.form.fixFields')}</Notice>}
        <button disabled={!writeAvailable || busy || hasVotes === null || extensionOnly || oldHostScheduled || isClosed(poll)} type="submit">
          {translate('action.save')}
        </button>
      </form>
    </section>
  );
}
