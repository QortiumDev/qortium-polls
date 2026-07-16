import { useState, type FormEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import { fromDateInput, minDateInput } from './pollFormat';
import { pollFieldErrors, POLL_LIMITS, validatePollFields } from './pollValidation';
import type { TranslateFunction } from './i18n';
import { ByteHelp, FieldHint, FieldMessage, Notice } from './ui';

type CreatePollProps = {
  busy: boolean;
  lockedNote: string;
  onSubmit: (request: Record<string, unknown>) => void;
  supports142: boolean;
  translate: TranslateFunction;
  writeAvailable: boolean;
};

export function CreatePoll({ busy, lockedNote, onSubmit, supports142, translate, writeAvailable }: CreatePollProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const fieldInput = {
    name,
    description,
    options,
    startTime: fromDateInput(start),
    endTime: fromDateInput(end),
    now: Date.now(),
  };
  const validation = validatePollFields(fieldInput);
  const errors = pollFieldErrors(fieldInput);

  function touch(field: string) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function shows(field: string) {
    return attempted || !!touched[field];
  }

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, currentIndex) => currentIndex === index ? value : option));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fresh = validatePollFields({ ...fieldInput, now: Date.now() });

    if (!fresh.ok) {
      setAttempted(true);
      return;
    }

    onSubmit({
      pollName: name,
      description: description || undefined,
      pollOptions: options,
      startTime: supports142 ? fromDateInput(start) : undefined,
      endTime: fromDateInput(end),
    });
  }

  return (
    <section className="workspace form-page">
      <div className="section-heading">
        <div>
          <h2>{translate('action.createPoll')}</h2>
          <p>{translate('label.createIntro')}</p>
        </div>
      </div>
      {lockedNote && <Notice tone="warning">{lockedNote}</Notice>}
      <form className="card form-card" onSubmit={submit} noValidate>
        <label>
          {translate('field.pollName')}
          <input
            value={name}
            maxLength={POLL_LIMITS.maxNameBytes}
            aria-invalid={shows('name') && !!errors.name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => touch('name')}
            required
          />
          <ByteHelp value={name} max={POLL_LIMITS.maxNameBytes} translate={translate} />
          <FieldHint>{translate('hint.nameLimit')}</FieldHint>
          <FieldMessage error={shows('name') && errors.name} translate={translate} />
        </label>
        <label>
          {translate('field.description')}
          <textarea
            value={description}
            maxLength={POLL_LIMITS.maxDescriptionBytes}
            aria-invalid={shows('description') && !!errors.description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => touch('description')}
          />
          <ByteHelp value={description} max={POLL_LIMITS.maxDescriptionBytes} translate={translate} />
          <FieldMessage error={shows('description') && errors.description} translate={translate} />
        </label>
        <div>
          <div className="section-heading">
            <h3>{translate('label.options')}</h3>
            <button
              type="button"
              className="minor-button"
              disabled={options.length >= POLL_LIMITS.maxOptions}
              onClick={() => setOptions((current) => [...current, ''])}
            >
              <Plus size={16} />
              {translate('action.addOption')}
            </button>
          </div>
          <small className="field-help">{translate('hint.optionLimit')}</small>
          {options.map((option, index) => (
            <div className="option-input" key={index}>
              <input
                value={option}
                maxLength={POLL_LIMITS.maxOptionBytes}
                aria-invalid={shows(`option-${index}`) && !!errors.options[index]}
                onChange={(event) => updateOption(index, event.target.value)}
                onBlur={() => touch(`option-${index}`)}
                placeholder={translate('placeholder.option', { number: index + 1 })}
              />
              <button
                type="button"
                className="minor-button"
                disabled={options.length <= POLL_LIMITS.minOptions}
                onClick={() => setOptions((current) => current.filter((_, currentIndex) => currentIndex !== index))}
              >
                {translate('action.remove')}
              </button>
              <FieldMessage error={shows(`option-${index}`) && errors.options[index]} translate={translate} />
            </div>
          ))}
        </div>
        {supports142 ? (
          <label>
            {translate('field.startTime')}
            <input
              type="datetime-local"
              value={start}
              min={minDateInput()}
              aria-invalid={shows('start') && !!errors.start}
              onChange={(event) => setStart(event.target.value)}
              onBlur={() => touch('start')}
            />
            <FieldHint>{translate('hint.startTime')}</FieldHint>
            <FieldMessage error={shows('start') && errors.start} translate={translate} />
          </label>
        ) : (
          <Notice tone="warning">{translate('label.approvalVotingUnavailable')}</Notice>
        )}
        <label>
          {translate('field.endTime')}
          <input
            type="datetime-local"
            value={end}
            min={minDateInput()}
            aria-invalid={shows('end') && !!errors.end}
            onChange={(event) => setEnd(event.target.value)}
            onBlur={() => touch('end')}
          />
          <FieldHint>{translate('hint.endTime')}</FieldHint>
          <FieldMessage error={shows('end') && errors.end} translate={translate} />
        </label>
        {attempted && !validation.ok && <Notice tone="error">{translate('error.form.fixFields')}</Notice>}
        <button disabled={!writeAvailable || busy} type="submit">
          <Check size={16} />
          {translate('action.createPoll')}
        </button>
      </form>
    </section>
  );
}
