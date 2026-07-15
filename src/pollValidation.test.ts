import { describe, expect, it } from 'vitest';
import { normalized, utf8Bytes, validatePollFields, validateVoteIndexes, type PollValidationCode } from './pollValidation';

const now = 1_000;
const base = {
  name: 'abc',
  description: '',
  options: ['one', 'two'],
  now,
};

function rejection(input: Parameters<typeof validatePollFields>[0]) {
  const result = validatePollFields(input);

  return result.ok ? 'OK' : result.code;
}

function voteRejection(input: Parameters<typeof validateVoteIndexes>[0]) {
  const result = validateVoteIndexes(input);

  return result.ok ? 'OK' : result.code;
}

describe('CreatePollTransaction field validation boundaries', () => {
  it.each<[string, Partial<Parameters<typeof validatePollFields>[0]>, 'OK' | PollValidationCode]>([
    ['name at 2 bytes', { name: 'ab' }, 'INVALID_NAME_LENGTH'],
    ['name at 3 bytes', { name: 'abc' }, 'OK'],
    ['name at 400 bytes', { name: 'a'.repeat(400) }, 'OK'],
    ['name at 401 bytes', { name: 'a'.repeat(401) }, 'INVALID_NAME_LENGTH'],
    ['multibyte name at 400 bytes', { name: `${'é'.repeat(199)}aa` }, 'OK'],
    ['multibyte name at 401 bytes', { name: `${'é'.repeat(200)}a` }, 'INVALID_NAME_LENGTH'],
    ['description at 4000 bytes', { description: 'a'.repeat(4000) }, 'OK'],
    ['description at 4001 bytes', { description: 'a'.repeat(4001) }, 'INVALID_DESCRIPTION_LENGTH'],
    ['one option', { options: ['one'] }, 'INVALID_OPTIONS_COUNT'],
    ['two options', { options: ['one', 'two'] }, 'OK'],
    ['1000 options', { options: Array.from({ length: 1000 }, (_, index) => `option-${index}`) }, 'OK'],
    ['1001 options', { options: Array.from({ length: 1001 }, (_, index) => `option-${index}`) }, 'INVALID_OPTIONS_COUNT'],
    ['zero-byte option', { options: ['', 'two'] }, 'INVALID_OPTION_LENGTH'],
    ['one-byte option', { options: ['a', 'two'] }, 'OK'],
    ['400-byte option', { options: ['a'.repeat(400), 'two'] }, 'OK'],
    ['401-byte option', { options: ['a'.repeat(401), 'two'] }, 'INVALID_OPTION_LENGTH'],
    ['case-different options', { options: ['A', 'a'] }, 'OK'],
    ['exact duplicate options', { options: ['A', 'A'] }, 'DUPLICATE_OPTION'],
  ])('%s returns the Core rejection name', (_, changes, expected) => {
    expect(rejection({ ...base, ...changes })).toBe(expected);
  });

  it.each<[string, Partial<Parameters<typeof validatePollFields>[0]>, 'OK' | PollValidationCode]>([
    ['start at now', { startTime: now }, 'INVALID_LIFETIME'],
    ['end at now', { endTime: now }, 'INVALID_LIFETIME'],
    ['start after end', { startTime: now + 20, endTime: now + 10 }, 'INVALID_LIFETIME'],
    ['start equal to end', { startTime: now + 10, endTime: now + 10 }, 'INVALID_LIFETIME'],
    ['future start without end', { startTime: now + 1 }, 'OK'],
    ['future end without start', { endTime: now + 1 }, 'OK'],
    ['ordered future pair', { startTime: now + 1, endTime: now + 2 }, 'OK'],
  ])('%s returns the Core rejection name', (_, changes, expected) => {
    expect(rejection({ ...base, ...changes })).toBe(expected);
  });
});

describe('Core Unicode.normalize name preflight', () => {
  it.each([
    ['NFKC full-width', 'ｐｏｌｌ', 'poll'],
    ['canonical combining form', 'e\u0301x', 'éx'],
    ['trim and collapse whitespace', '  poll\t name  ', 'poll name'],
    ['zero-width character removed', 'po\u200bll', 'poll'],
    ['visual blank becomes space', 'poll\u2800name', 'poll name'],
    ['private-use character removed', 'po\ue000ll', 'poll'],
  ])('%s follows Core normalization', (_, input, expected) => {
    expect(normalized(input)).toBe(expected);
    expect(rejection({ ...base, name: input })).toBe('NAME_NOT_NORMALIZED');
  });

  it('uses UTF-8 bytes rather than JavaScript code-unit length', () => {
    expect(utf8Bytes('é')).toBe(2);
    expect(utf8Bytes('😀')).toBe(4);
  });
});

describe('VoteOnPollTransaction option-index matrix', () => {
  it.each<[string, Parameters<typeof validateVoteIndexes>[0], 'OK' | PollValidationCode]>([
    ['legacy single option 0 removes an existing vote', { optionCount: 3, optionIndex: 0, previousIndexes: [1] }, 'OK'],
    ['legacy single option 1', { optionCount: 3, optionIndex: 1 }, 'OK'],
    ['legacy maximum option', { optionCount: 3, optionIndex: 3 }, 'OK'],
    ['legacy maximum plus one', { optionCount: 3, optionIndex: 4 }, 'POLL_OPTION_DOES_NOT_EXIST'],
    ['multi empty removes an existing vote', { optionCount: 3, optionIndexes: [], previousIndexes: [1] }, 'OK'],
    ['multi [0] removes an existing vote', { optionCount: 3, optionIndexes: [0], previousIndexes: [1] }, 'OK'],
    ['multi [1, 3]', { optionCount: 3, optionIndexes: [1, 3] }, 'OK'],
    ['multi duplicate', { optionCount: 3, optionIndexes: [1, 1] }, 'POLL_OPTION_DOES_NOT_EXIST'],
    ['multi mixed zero', { optionCount: 3, optionIndexes: [0, 1] }, 'POLL_OPTION_DOES_NOT_EXIST'],
    ['multi out of range', { optionCount: 3, optionIndexes: [4] }, 'POLL_OPTION_DOES_NOT_EXIST'],
    ['empty removal without stored vote', { optionCount: 3, optionIndexes: [] }, 'ALREADY_VOTED_FOR_THAT_OPTION'],
    ['legacy removal without stored vote', { optionCount: 3, optionIndex: 0 }, 'ALREADY_VOTED_FOR_THAT_OPTION'],
    ['same sorted multi vote', { optionCount: 3, optionIndexes: [3, 1], previousIndexes: [1, 3] }, 'ALREADY_VOTED_FOR_THAT_OPTION'],
    ['consistent legacy and multi selector', { optionCount: 3, optionIndex: 2, optionIndexes: [2] }, 'OK'],
    ['consistent zero and empty selector', { optionCount: 3, optionIndex: 0, optionIndexes: [], previousIndexes: [1] }, 'OK'],
    ['consistent zero and [0] selector', { optionCount: 3, optionIndex: 0, optionIndexes: [0], previousIndexes: [1] }, 'OK'],
    ['conflicting selectors', { optionCount: 3, optionIndex: 1, optionIndexes: [2] }, 'POLL_OPTION_DOES_NOT_EXIST'],
    ['conflicting zero and real selector', { optionCount: 3, optionIndex: 0, optionIndexes: [1] }, 'POLL_OPTION_DOES_NOT_EXIST'],
    ['conflicting single and empty selector', { optionCount: 3, optionIndex: 1, optionIndexes: [] }, 'POLL_OPTION_DOES_NOT_EXIST'],
  ])('%s returns the Core rejection name', (_, input, expected) => {
    expect(voteRejection(input)).toBe(expected);
  });
});
