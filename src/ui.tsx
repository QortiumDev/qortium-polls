import type { ReactNode } from 'react';
import { POLL_LIMITS, utf8Bytes, type FieldError as FieldErrorValue } from './pollValidation';
import type { TranslateFunction } from './i18n';

export function ByteHelp({ value, max, translate }: { value: string; max: number; translate: TranslateFunction }) {
  const count = utf8Bytes(value);
  const tone = count > max ? ' field-help--over' : count >= max * 0.9 ? ' field-help--warn' : '';

  return <small className={`field-help${tone}`}>{translate('label.charCount', { count, max })}</small>;
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <small className="field-help">{children}</small>;
}

export function FieldMessage({ error, translate }: { error: FieldErrorValue | false | undefined; translate: TranslateFunction }) {
  if (!error) {
    return null;
  }

  return <small className="field-error" role="alert">{translate(error.key, error.params)}</small>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'error' | 'info' | 'warning' }) {
  return <div className={`notice notice--${tone}`}>{children}</div>;
}

export { POLL_LIMITS };
