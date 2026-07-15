/** Client-side mirror of qortium-core poll validation. Core remains authoritative. */
export const POLL_LIMITS = {
  minNameBytes: 3,
  maxNameBytes: 400,
  maxDescriptionBytes: 4000,
  minOptions: 2,
  maxOptions: 1000,
  minOptionBytes: 1,
  maxOptionBytes: 400,
} as const;

export type PollValidationCode =
  | 'INVALID_NAME_LENGTH'
  | 'NAME_NOT_NORMALIZED'
  | 'INVALID_DESCRIPTION_LENGTH'
  | 'INVALID_OPTIONS_COUNT'
  | 'INVALID_OPTION_LENGTH'
  | 'DUPLICATE_OPTION'
  | 'INVALID_LIFETIME'
  | 'POLL_OPTION_DOES_NOT_EXIST'
  | 'ALREADY_VOTED_FOR_THAT_OPTION';

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: PollValidationCode; message: string };

const encoder = new TextEncoder();
const valid: ValidationResult = { ok: true };
function invalid(code: PollValidationCode, message: string): ValidationResult {
  return { ok: false, code, message };
}

export function utf8Bytes(value: string) {
  return encoder.encode(value).byteLength;
}

/** Mirrors Core Unicode.normalize(): NFKC, unsafe/invisible removal, then trimmed/collapsed whitespace. */
export function normalized(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\u2800\u115f\u1160\u3164\uffa0]/gu, ' ')
    .replace(/\p{C}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function validatePollFields(input: {
  name: string;
  description?: string;
  options: string[];
  startTime?: number | null;
  endTime?: number | null;
  now: number;
}): ValidationResult {
  const nameBytes = utf8Bytes(input.name);

  if (nameBytes < POLL_LIMITS.minNameBytes || nameBytes > POLL_LIMITS.maxNameBytes) {
    return invalid('INVALID_NAME_LENGTH', 'Poll name must be 3–400 UTF-8 bytes.');
  }

  if (utf8Bytes(input.description ?? '') > POLL_LIMITS.maxDescriptionBytes) {
    return invalid('INVALID_DESCRIPTION_LENGTH', 'Description must be at most 4000 UTF-8 bytes.');
  }

  if (input.name !== normalized(input.name)) {
    return invalid('NAME_NOT_NORMALIZED', 'Poll name must match Core Unicode normalization.');
  }

  if (
    (input.startTime != null && input.startTime <= input.now)
    || (input.endTime != null && input.endTime <= input.now)
    || (input.startTime != null && input.endTime != null && input.startTime >= input.endTime)
  ) {
    return invalid('INVALID_LIFETIME', 'Start/end times must be future epoch-ms values and start must precede end.');
  }

  if (input.options.length < POLL_LIMITS.minOptions || input.options.length > POLL_LIMITS.maxOptions) {
    return invalid('INVALID_OPTIONS_COUNT', 'A poll must have 2–1000 options.');
  }

  const seen = new Set<string>();

  for (const option of input.options) {
    const bytes = utf8Bytes(option);

    if (bytes < POLL_LIMITS.minOptionBytes || bytes > POLL_LIMITS.maxOptionBytes) {
      return invalid('INVALID_OPTION_LENGTH', 'Each option must be 1–400 UTF-8 bytes.');
    }

    if (seen.has(option)) {
      return invalid('DUPLICATE_OPTION', 'Options must be unique using an exact, case-sensitive match.');
    }

    seen.add(option);
  }

  return valid;
}

/** Validates Core's normalized optionIndexes input, including legacy optionIndex conflicts. */
export function validateVoteIndexes(input: {
  optionCount: number;
  optionIndex?: number | null;
  optionIndexes?: number[] | null;
  previousIndexes?: number[] | null;
}): ValidationResult {
  const supplied = input.optionIndexes;

  if (supplied !== undefined && supplied !== null && input.optionIndex !== undefined && input.optionIndex !== null) {
    const consistent = (
      input.optionIndex === 0
      && (supplied.length === 0 || (supplied.length === 1 && supplied[0] === 0))
    ) || (supplied.length === 1 && supplied[0] === input.optionIndex);

    if (!consistent) {
      return invalid('POLL_OPTION_DOES_NOT_EXIST', 'optionIndex conflicts with optionIndexes.');
    }
  }

  const values = supplied == null ? [input.optionIndex ?? 0] : supplied;
  const removal = values.length === 0 || (values.length === 1 && values[0] === 0);

  if (!removal) {
    const unique = new Set<number>();

    for (const index of values) {
      if (!Number.isInteger(index) || index <= 0 || index > input.optionCount || unique.has(index)) {
        return invalid('POLL_OPTION_DOES_NOT_EXIST', 'Option indexes must be unique, 1-based, and within the poll option count.');
      }

      unique.add(index);
    }
  }

  const normalizedIndexes = removal ? [] : [...values].sort((a, b) => a - b);

  if (
    input.previousIndexes
    && input.previousIndexes.length === normalizedIndexes.length
    && input.previousIndexes.every((value, index) => value === normalizedIndexes[index])
  ) {
    return invalid('ALREADY_VOTED_FOR_THAT_OPTION', 'This vote is identical to the stored vote.');
  }

  if ((!input.previousIndexes || input.previousIndexes.length === 0) && removal) {
    return invalid('ALREADY_VOTED_FOR_THAT_OPTION', 'There is no stored vote to remove.');
  }

  return valid;
}
