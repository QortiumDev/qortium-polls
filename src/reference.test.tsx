import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { REFERENCE_SECTIONS, referenceSectionUrl } from './ReferenceNavigation';
import { Reference, getPollReferenceExamples } from './Reference';
import { POLL_LIMITS, validatePollFields } from './pollValidation';
import { POLL_PAGE_SIZE } from './BrowsePolls';

describe('Developers contract', () => {
  const markup = renderToStaticMarkup(<Reference supports142={true} />);
  it('provides accessible, English sections, selectable examples and copy status', () => {
    expect(markup).toContain('lang="en"');
    expect(markup).toContain('dir="ltr"');
    expect(markup).toContain('aria-label="Developer reference sections"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('role="status"');
    for (const [id] of REFERENCE_SECTIONS) expect(markup).toContain(`id="${id}"`);
    for (const text of ['Core is', 'SHOW_ACTIONS', 'public', 'approval', 'unknown', 'view=developers']) expect(markup).toContain(text);
  });
  it('keeps section links on the current Core path with all query values', () => {
    const url = referenceSectionUrl('https://node.test/render/APP/Mirror/other/42?view=developers&qdnHomeBridge=test&future=a&future=b#old', 'reference-reads');
    expect(url).toBe('/render/APP/Mirror/other/42?view=developers&qdnHomeBridge=test&future=a&future=b#reference-reads');
  });
  it('renders live poll limits and exports capability/read/write/confirmation examples', () => {
    for (const value of Object.values(POLL_LIMITS)) expect(markup).toContain(String(value));
    const examples = getPollReferenceExamples(true);
    expect(Object.keys(examples)).toEqual(['capabilities', 'read', 'confirmation', 'create', 'vote', 'update']);
    expect(examples.read).toContain(`limit=${POLL_PAGE_SIZE}`);
    expect(examples.confirmation).toContain('response.data.blockHeight');
    expect(examples.vote).toContain('optionIndexes: [1, 2]');
    expect(examples.create).toContain('startTime');
    const legacy = getPollReferenceExamples(false);
    expect(legacy.create).not.toContain('startTime');
    expect(legacy.vote).toContain('optionIndex: 1');
    expect(legacy.update).not.toContain('newStartTime');
    expect(validatePollFields({ name: 'Example poll', description: 'Optional', options: ['Yes', 'No'], now: 0, startTime: 60_000, endTime: 86_400_000 })).toEqual({ ok: true });
  });
});
