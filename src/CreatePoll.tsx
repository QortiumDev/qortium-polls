// Demonstrates CREATE_POLL's UTF-8 limits, normalized names, exact option uniqueness, and lifetime rules.
import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { fromDateInput } from './pollFormat';
import { validatePollFields, type ValidationResult } from './pollValidation';
import type { TranslateFunction } from './i18n';
import { ByteHelp, Notice } from './ui';

type CreatePollProps = {
  busy: boolean;
  lockedNote: string;
  onSubmit: (request: Record<string, unknown>) => void;
  supports142: boolean;
  translate: TranslateFunction;
  writeAvailable: boolean;
};

function validationText(validation: ValidationResult, translate: TranslateFunction) {
  if (validation.ok) {
    return '';
  }

  const keys = {
    DUPLICATE_OPTION: 'error.validation.duplicateOption',
    INVALID_DESCRIPTION_LENGTH: 'error.validation.invalidDescriptionLength',
    INVALID_LIFETIME: 'error.validation.invalidLifetime',
    INVALID_NAME_LENGTH: 'error.validation.invalidNameLength',
    INVALID_OPTION_LENGTH: 'error.validation.invalidOptionLength',
    INVALID_OPTIONS_COUNT: 'error.validation.invalidOptionsCount',
    NAME_NOT_NORMALIZED: 'error.validation.nameNotNormalized',
    POLL_OPTION_DOES_NOT_EXIST: 'error.validation.optionDoesNotExist',
    ALREADY_VOTED_FOR_THAT_OPTION: 'error.validation.repeatVote',
  } as const;

  return translate(keys[validation.code]);
}

export function CreatePoll({ busy, lockedNote, onSubmit, supports142, translate, writeAvailable }: CreatePollProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const validation = validatePollFields({
    name,
    description,
    options,
    startTime: fromDateInput(start),
    endTime: fromDateInput(end),
    now: Date.now(),
  });

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, currentIndex) => currentIndex === index ? value : option));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validation.ok) {
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
          <p>{translate('label.coreRule')}</p>
        </div>
      </div>
      {lockedNote && <Notice tone="warning">{lockedNote}</Notice>}
      <form className="card form-card" onSubmit={submit}>
        <label>
          {translate('field.pollName')}
          <input value={name} onChange={(event) => setName(event.target.value)} required />
          <ByteHelp value={name} range={translate('hint.nameLimit')} translate={translate} />
        </label>
        <label>
          {translate('field.description')}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          <ByteHelp value={description} range={translate('hint.descriptionLimit')} translate={translate} />
        </label>
        <div>
          <div className="section-heading">
            <h3>{translate('label.options')}</h3>
            <button type="button" className="minor-button" disabled={options.length >= 1000} onClick={() => setOptions((current) => [...current, ''])}>
              <Plus size={16} />
              {translate('action.addOption')}
            </button>
          </div>
          <small className="field-help">{translate('hint.optionLimit')}</small>
          {options.map((option, index) => (
            <div className="option-input" key={index}>
              <input
                value={option}
                onChange={(event) => updateOption(index, event.target.value)}
                placeholder={translate('placeholder.option', { number: index + 1 })}
              />
              <ByteHelp value={option} range={translate('hint.optionByteRange')} translate={translate} />
              <button
                type="button"
                className="minor-button"
                disabled={options.length <= 2}
                onClick={() => setOptions((current) => current.filter((_, currentIndex) => currentIndex !== index))}
              >
                {translate('action.remove')}
              </button>
            </div>
          ))}
        </div>
        {supports142 ? (
          <label>
            {translate('field.startTime')}
            <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
            <small className="field-help">{translate('hint.startTime')}</small>
          </label>
        ) : (
          <Notice tone="warning">{translate('label.approvalVotingUnavailable')}</Notice>
        )}
        <label>
          {translate('field.endTime')}
          <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
          <small className="field-help">{translate('hint.endTime')}</small>
        </label>
        {!validation.ok && <Notice tone="error">{validation.code}: {validationText(validation, translate)}</Notice>}
        <button disabled={!writeAvailable || !validation.ok || busy} type="submit">
          <Check size={16} />
          {translate('action.createPoll')}
        </button>
      </form>
    </section>
  );
}
