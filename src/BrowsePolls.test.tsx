import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrowsePolls } from './BrowsePolls';
import { createTranslator } from './i18n';
import type { Poll } from './types';

const translate = createTranslator('en');
const poll: Poll = {
  pollId: 42,
  pollName: 'Known poll',
  owner: 'Qowner',
  pollOptions: [{ optionName: 'Yes' }, { optionName: 'No' }],
};

function renderBrowse(overrides: Partial<Parameters<typeof BrowsePolls>[0]> = {}) {
  return renderToStaticMarkup(<BrowsePolls
    language="en"
    loaded={false}
    loading={true}
    offset={0}
    onOpen={() => undefined}
    onOwner={() => undefined}
    onPage={() => undefined}
    onQuery={() => undefined}
    onReverse={() => undefined}
    onSearch={() => undefined}
    onStatus={() => undefined}
    owner=""
    polls={[]}
    query=""
    reverse
    status="OPEN"
    translate={translate}
    {...overrides}
  />);
}

describe('poll list loading states', () => {
  it('does not claim an empty result before the initial request resolves', () => {
    const markup = renderBrowse();

    expect(markup).toContain('Loading polls…');
    expect(markup).not.toContain('No polls found.');
  });

  it('keeps confirmed polls visible while a refresh is pending', () => {
    const markup = renderBrowse({ loaded: false, loading: true, polls: [poll] });

    expect(markup).toContain('Known poll');
    expect(markup).toContain('Loading polls…');
    expect(markup).not.toContain('No polls found.');
  });

  it('shows the empty state only after a successful empty result', () => {
    expect(renderBrowse({ loaded: true, loading: false })).toContain('No polls found.');
    expect(renderBrowse({ loaded: false, loading: false })).not.toContain('No polls found.');
  });
});
