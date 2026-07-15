import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { BrowsePolls, POLL_PAGE_SIZE } from './BrowsePolls';
import { CreatePoll } from './CreatePoll';
import { applyDisplaySettings, getDisplaySettingsUpdateFromMessage, getInitialDisplaySettings } from './displaySettings';
import { createTranslator } from './i18n';
import { MyPolls } from './MyPolls';
import { errorText, friendlyWriteError, getAccountVoteIndexes, responseData, versionAtLeast } from './pollFormat';
import { PollDetail } from './PollDetail';
import { validateVoteIndexes } from './pollValidation';
import { getBridgeState, qdnRequest } from './qdnRequest';
import { Reference } from './Reference';
import type { BridgeState, HostInfo, Poll, PollVotes } from './types';
import { Notice } from './ui';
import { getPollWriteAvailability } from './writeAvailability';

type Tab = 'browse' | 'create' | 'mine' | 'reference';
type Filters = { owner: string; query: string; reverse?: boolean; status: string };

const emptyBridge: BridgeState = {
  actions: [],
  isHomeBridge: false,
  isUsingPublicNode: false,
  ui: 'BROWSER_DEV',
};

export function App() {
  const [tab, setTab] = useState<Tab>('browse');
  const [bridge, setBridge] = useState(emptyBridge);
  const [host, setHost] = useState<HostInfo | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [myPolls, setMyPolls] = useState<Poll[]>([]);
  const [selected, setSelected] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<PollVotes | null>(null);
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [reverse, setReverse] = useState(true);
  const [offset, setOffset] = useState(0);
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMine, setLoadingMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState(getInitialDisplaySettings);
  const translate = useMemo(() => createTranslator(settings.language), [settings.language]);
  const supports142 = versionAtLeast(host?.hostVersion);
  const writeState = getPollWriteAvailability(bridge.actions, !!bridge.isUsingPublicNode);
  const writeAvailable = writeState.available;
  const lockedNote = !writeAvailable
    ? bridge.isUsingPublicNode
      ? translate('node.publicUnsupported')
      : translate('node.writeUnavailable')
    : '';
  const publicWriteNote = writeState.publicSigning
    ? translate('node.publicSigning')
    : '';

  useEffect(() => {
    applyDisplaySettings(settings);
  }, [settings]);

  useEffect(() => {
    function listener(event: MessageEvent) {
      const updated = getDisplaySettingsUpdateFromMessage(event.data, settings);

      if (updated) {
        setSettings(updated);
      }
    }

    window.addEventListener('message', listener);

    return () => window.removeEventListener('message', listener);
  }, [settings]);

  async function loadContext() {
    try {
      const state = await getBridgeState();
      setBridge(state);

      try {
        setHost(await qdnRequest<HostInfo>({ action: 'GET_HOST_INFO' }));
      } catch {
        setHost(null);
      }

      try {
        const selectedAccount = await qdnRequest<{ address?: string }>({ action: 'GET_SELECTED_ACCOUNT' });
        setAccount(selectedAccount.address ?? '');
      } catch {
        setAccount('');
      }
    } catch (error) {
      setMessage(errorText(error, translate('error.default')));
    }
  }

  async function loadPolls(
    nextOffset = offset,
    filters: Filters = { query, owner, status, reverse },
    destination: 'browse' | 'mine' = 'browse',
  ) {
    const setDestinationPolls = destination === 'mine' ? setMyPolls : setPolls;
    const setDestinationLoading = destination === 'mine' ? setLoadingMine : setLoading;

    setDestinationLoading(true);
    setMessage('');

    try {
      const params = new URLSearchParams({
        limit: String(POLL_PAGE_SIZE),
        offset: String(nextOffset),
        reverse: String(filters.reverse ?? reverse),
        status: filters.status,
      });

      if (filters.query.trim()) {
        params.set('query', filters.query.trim());
      }

      if (filters.owner.trim()) {
        params.set('owner', filters.owner.trim());
      }

      const result = responseData<Poll[]>(await qdnRequest({
        action: 'FETCH_NODE_API',
        path: `/polls/search?${params}`,
        maxBytes: 1_000_000,
      }));
      setDestinationPolls(Array.isArray(result) ? result : []);

      if (destination === 'browse') {
        setOffset(nextOffset);
      }
    } catch (error) {
      setDestinationPolls([]);
      setMessage(errorText(error, translate('error.loadPolls')));
    } finally {
      setDestinationLoading(false);
    }
  }

  useEffect(() => {
    void loadContext().then(() => loadPolls(0));
  }, []);

  async function openPoll(poll: Poll) {
    setSelected(poll);
    setVotes(null);
    setTab('browse');

    try {
      const result = responseData<PollVotes>(await qdnRequest({
        action: 'FETCH_NODE_API',
        path: `/polls/votes/id/${poll.pollId}?onlyCounts=false`,
        maxBytes: 2_000_000,
      }));
      setVotes(result);
    } catch (error) {
      setMessage(errorText(error, translate('error.loadResults')));
    }
  }

  function refresh() {
    void loadContext().then(() => loadPolls(offset));

    if (selected) {
      void openPoll(selected);
    }
  }

  async function submitVote(indexes: number[]) {
    if (!selected) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const validation = validateVoteIndexes({
        optionCount: selected.pollOptions.length,
        optionIndexes: supports142 ? indexes : undefined,
        optionIndex: supports142 ? undefined : indexes[0] ?? 0,
        previousIndexes: getAccountVoteIndexes(votes, account),
      });

      if (!validation.ok) {
        throw new Error(validation.code);
      }

      await qdnRequest({
        action: 'VOTE_ON_POLL',
        pollId: selected.pollId,
        ...(supports142 ? { optionIndexes: indexes } : { optionIndex: indexes[0] ?? 0 }),
      });
      setMessage(translate('status.submittedVote'));
    } catch (error) {
      setMessage(friendlyWriteError(error, lockedNote || translate('node.publicReadOnly')));
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate(request: Record<string, unknown>) {
    setBusy(true);
    setMessage('');

    try {
      await qdnRequest({ action: 'CREATE_POLL', ...request });
      setMessage(translate('status.submittedCreate'));
    } catch (error) {
      setMessage(friendlyWriteError(error, lockedNote || translate('node.publicReadOnly')));
    } finally {
      setBusy(false);
    }
  }

  async function submitUpdate(request: Record<string, unknown>) {
    setBusy(true);
    setMessage('');

    try {
      await qdnRequest({ action: 'UPDATE_POLL', ...request });
      setMessage(translate('status.submittedUpdate'));
    } catch (error) {
      setMessage(friendlyWriteError(error, lockedNote || translate('node.publicReadOnly')));
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    return (
      <PollDetail
        poll={selected}
        votes={votes}
        account={account}
        language={settings.language}
        supports142={supports142}
        writeAvailable={writeAvailable}
        lockedNote={lockedNote}
        busy={busy}
        message={message}
        translate={translate}
        onBack={() => setSelected(null)}
        onRefresh={() => void openPoll(selected)}
        onVote={submitVote}
      />
    );
  }

  const tabs: [Tab, ReturnType<typeof translate>][] = [
    ['browse', translate('tab.browse')],
    ['create', translate('tab.create')],
    ['mine', translate('tab.mine')],
    ['reference', translate('tab.reference')],
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{translate('app.eyebrow', { version: __APP_VERSION__ })}</p>
          <h1>{translate('app.title')}</h1>
          <p className="subtitle">{translate('app.subtitle')}</p>
        </div>
        <button className="icon-button" onClick={refresh} aria-label={translate('aria.refresh')}>
          <RefreshCw size={18} />
        </button>
      </header>
      <nav className="tabs" aria-label={translate('aria.pollSections')}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'tab active' : 'tab'}
            onClick={() => {
              setTab(key);

              if (key === 'mine' && account) {
                void loadPolls(0, { query: '', owner: account, status: 'ALL' }, 'mine');
              }
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {lockedNote && <Notice tone="warning">{lockedNote}</Notice>}
      {publicWriteNote && <Notice>{publicWriteNote}</Notice>}
      {message && <Notice tone="error">{message}</Notice>}
      {tab === 'browse' && (
        <BrowsePolls
          polls={polls}
          loading={loading}
          query={query}
          owner={owner}
          status={status}
          reverse={reverse}
          offset={offset}
          language={settings.language}
          translate={translate}
          onQuery={setQuery}
          onOwner={setOwner}
          onStatus={setStatus}
          onReverse={setReverse}
          onSearch={(event) => {
            event.preventDefault();
            void loadPolls(0);
          }}
          onPage={(value) => void loadPolls(Math.max(0, value))}
          onOpen={openPoll}
        />
      )}
      {tab === 'create' && (
        <CreatePoll
          supports142={supports142}
          writeAvailable={writeAvailable}
          lockedNote={lockedNote}
          onSubmit={submitCreate}
          busy={busy}
          translate={translate}
        />
      )}
      {tab === 'mine' && (
        <MyPolls
          account={account}
          polls={myPolls}
          loading={loadingMine}
          supports142={supports142}
          writeAvailable={writeAvailable}
          lockedNote={lockedNote}
          onOpen={openPoll}
          onUpdate={submitUpdate}
          busy={busy}
          translate={translate}
        />
      )}
      {tab === 'reference' && <Reference supports142={supports142} />}
    </main>
  );
}
