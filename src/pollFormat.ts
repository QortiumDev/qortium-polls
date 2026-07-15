import type { TranslateFunction } from './i18n';
import type { Poll } from './types';

export function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function friendlyWriteError(error: unknown, fallback: string) {
  const message = errorText(error, fallback);

  return message.includes('PUBLIC_NODE_READ_ONLY') || /public.*(read.?only|network node)|trusted custom node/i.test(message)
    ? fallback
    : message;
}

export function dateText(value: number | null | undefined, language: string, noEndTime: string) {
  if (!value) {
    return noEndTime;
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function toDateInput(value: number | null | undefined) {
  if (!value) {
    return '';
  }

  return new Date(value - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function fromDateInput(value: string) {
  return value ? new Date(value).getTime() : undefined;
}

export function isScheduled(poll: Poll, now = Date.now()) {
  return !!poll.startTime && poll.startTime > now;
}

export function isClosed(poll: Poll, now = Date.now()) {
  return !!poll.endTime && poll.endTime <= now;
}

export function stateLabel(poll: Poll, translate: TranslateFunction) {
  if (isClosed(poll)) {
    return translate('status.closed');
  }

  if (isScheduled(poll)) {
    return translate('status.scheduled');
  }

  return translate('status.open');
}

export function responseData<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data;
  }

  return value as T;
}

export function versionAtLeast(version: string | undefined, target = '1.4.2') {
  if (!version) {
    return false;
  }

  const actual = version.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
  const required = target.split('.').map(Number);

  for (let index = 0; index < Math.max(actual.length, required.length); index += 1) {
    const current = actual[index] ?? 0;
    const expected = required[index] ?? 0;

    if (current !== expected) {
      return current > expected;
    }
  }

  return true;
}
