import type { ReactNode } from 'react';
import { utf8Bytes } from './pollValidation';
import type { TranslateFunction } from './i18n';

export function ByteHelp({ value, range, translate }: { value: string; range: string; translate: TranslateFunction }) {
  return <small className="field-help">{translate('label.bytes', { count: utf8Bytes(value), range })}</small>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'error' | 'info' | 'warning' }) {
  return <div className={`notice notice--${tone}`}>{children}</div>;
}
