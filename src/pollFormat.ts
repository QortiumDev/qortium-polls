import type { TranslateFunction } from './i18n';
import type { MessageKey } from './locales/en';
import type { Poll, PollVotes } from './types';

export function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function friendlyWriteError(error: unknown, fallback: string) {
  const message = errorText(error, fallback);

  return message.includes('PUBLIC_NODE_READ_ONLY') || /public.*(read.?only|network node)|trusted custom node/i.test(message)
    ? fallback
    : message;
}

const CORE_REJECTION_KEYS: [string, MessageKey][] = [
  ['ALREADY_VOTED_FOR_THAT_OPTION', 'error.validation.repeatVote'],
  ['DUPLICATE_OPTION', 'error.validation.duplicateOption'],
  ['INVALID_DESCRIPTION_LENGTH', 'error.validation.invalidDescriptionLength'],
  ['INVALID_LIFETIME', 'error.validation.invalidLifetime'],
  ['INVALID_NAME_LENGTH', 'error.validation.invalidNameLength'],
  ['INVALID_OPTION_LENGTH', 'error.validation.invalidOptionLength'],
  ['INVALID_OPTIONS_COUNT', 'error.validation.invalidOptionsCount'],
  ['NAME_NOT_NORMALIZED', 'error.validation.nameNotNormalized'],
  ['POLL_OPTION_DOES_NOT_EXIST', 'error.validation.optionDoesNotExist'],
  ['POLL_CLOSED', 'vote.closed'],
];

/** Finds the plain-language locale key for a Core rejection code inside an error message, if any. */
export function coreRejectionKey(error: unknown): MessageKey | null {
  const message = errorText(error, '');
  const match = CORE_REJECTION_KEYS.find(([code]) => message.includes(code));

  return match ? match[1] : null;
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

export function isUnchangedDateInput(value: string, original: number | null | undefined) {
  return value === toDateInput(original);
}

export function preservedDateInputValue(value: string, original: number | null | undefined) {
  return isUnchangedDateInput(value, original) ? original ?? undefined : fromDateInput(value);
}

export function getAccountVoteIndexes(votes: PollVotes | null, account: string) {
  const vote = votes?.voteDetails?.find((item) => item.voterAddress === account);

  if (Array.isArray(vote?.optionIndexes)) {
    return vote.optionIndexes;
  }

  return typeof vote?.optionIndex === 'number' && vote.optionIndex > 0 ? [vote.optionIndex] : [];
}

export function isScheduled(poll: Poll, now = Date.now()) {
  return !!poll.startTime && poll.startTime > now;
}

export function isClosed(poll: Poll, now = Date.now()) {
  return !!poll.endTime && poll.endTime <= now;
}

/** Stable state slug for CSS classes; never derive class names from translated labels. */
export function stateKey(poll: Poll, now = Date.now()): 'closed' | 'open' | 'scheduled' {
  if (isClosed(poll, now)) {
    return 'closed';
  }

  return isScheduled(poll, now) ? 'scheduled' : 'open';
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

/** Smallest value for a datetime-local `min` attribute that is still in the future. */
export function minDateInput(afterMs = Date.now()) {
  return toDateInput(afterMs + 60_000);
}

export function responseData<T>(value: unknown): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const response = value as {
      body?: unknown;
      data?: T;
      ok?: unknown;
      status?: unknown;
      statusText?: unknown;
    };

    if (typeof response.ok === 'boolean' && !response.ok) {
      const body = typeof response.body === 'string' ? response.body.trim() : '';
      const status = typeof response.status === 'number' ? response.status : 0;
      const statusText = typeof response.statusText === 'string' ? response.statusText.trim() : '';

      throw new Error(body || `Node API failed with HTTP ${status}${statusText ? ` ${statusText}` : ''}.`);
    }

    if ('data' in response) {
      return response.data as T;
    }
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
