import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { BrowsePolls, POLL_PAGE_SIZE } from './BrowsePolls';
import { CreatePoll } from './CreatePoll';
import { buildPollLink, getCurrentPollRoute, getInitialPollRoute, getPollRouteUrl } from './deepLink';
import { applyDisplaySettings, getDisplaySettingsUpdateFromMessage, getInitialDisplaySettings } from './displaySettings';
import { createTranslator } from './i18n';
import { MyPolls } from './MyPolls';
import { coreRejectionKey, errorText, friendlyWriteError, getAccountVoteIndexes, responseData, versionAtLeast } from './pollFormat';
import { PollDetail } from './PollDetail';
import { validateVoteIndexes, validationMessageKey } from './pollValidation';
import { getBridgeState, qdnRequest } from './qdnRequest';
import { Reference } from './Reference';
import type { BridgeState, HostInfo, PendingVote, Poll, PollVotes } from './types';
import { Notice } from './ui';
import { loadVoterIdentities, type VoterIdentity } from './voterIdentities';
import { getPollWriteAvailability } from './writeAvailability';

type Tab = 'browse' | 'create' | 'mine' | 'reference';
type Filters = { owner: string; query: string; reverse?: boolean; status: string };
type Message = { text: string; tone: 'error' | 'info' } | null;
type DirectLinkState = 'none' | 'loading' | 'invalid' | 'not-found' | 'error';
type HistoryMode = 'none' | 'push' | 'replace';

const emptyBridge: BridgeState = {
  actions: [],
  isHomeBridge: false,
  isUsingPublicNode: false,
  ui: 'BROWSER_DEV',
};

const VOTE_WATCH_FAST_MS = 3_000;
const VOTE_WATCH_SLOW_MS = 10_000;
const VOTE_WATCH_FAST_WINDOW_MS = 30_000;
const VOTE_WATCH_TIMEOUT_MS = 600_000;
const VOTE_CONFIRMED_LINGER_MS = 6_000;

function sortedIndexes(values: number[]) {
  return [...values].sort((a, b) => a - b);
}

function sameIndexes(a: number[], b: number[]) {
  const left = sortedIndexes(a);
  const right = sortedIndexes(b);

  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function App() {
  const [initialPollRoute] = useState(getInitialPollRoute);
  const [tab, setTab] = useState<Tab>('browse');
  const [bridge, setBridge] = useState(emptyBridge);
  const [host, setHost] = useState<HostInfo | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [myPolls, setMyPolls] = useState<Poll[]>([]);
  const [pollsLoaded, setPollsLoaded] = useState(false);
  const [myPollsLoaded, setMyPollsLoaded] = useState(false);
  const [selected, setSelected] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<PollVotes | null>(null);
  const [voterIdentities, setVoterIdentities] = useState<ReadonlyMap<string, VoterIdentity>>(() => new Map());
  const [votesLoading, setVotesLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [reverse, setReverse] = useState(true);
  const [offset, setOffset] = useState(0);
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMine, setLoadingMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [pendingVote, setPendingVote] = useState<PendingVote | null>(null);
  const [directLinkState, setDirectLinkState] = useState<DirectLinkState>(
    initialPollRoute.kind === 'poll'
      ? 'loading'
      : initialPollRoute.kind === 'invalid'
        ? 'invalid'
        : 'none',
  );
  const [settings, setSettings] = useState(getInitialDisplaySettings);
  const openRequestRef = useRef(0);
  const browseRequestRef = useRef(0);
  const mineRequestRef = useRef(0);
  const browseResultKeyRef = useRef('');
  const mineResultKeyRef = useRef('');
  const selectedRef = useRef<Poll | null>(null);
  const translate = useMemo(() => createTranslator(settings.language), [settings.language]);
  const bridgeActionsKey = bridge.actions.join('\u0000');
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

  selectedRef.current = selected;

  useEffect(() => {
    applyDisplaySettings(settings);
  }, [settings]);

  useEffect(() => {
    const addresses = votes?.voteDetails?.map((detail) => detail.voterAddress) ?? [];

    if (!selected || !addresses.length) {
      setVoterIdentities(new Map());
      return;
    }

    let active = true;

    void loadVoterIdentities(addresses, bridge.actions)
      .then((identities) => {
        if (active) {
          setVoterIdentities(identities);
        }
      })
      .catch(() => {
        if (active) {
          setVoterIdentities(new Map());
        }
      });

    return () => {
      active = false;
    };
  }, [selected?.pollId, votes, bridgeActionsKey]);

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
    const [bridgeResult, hostResult, accountResult] = await Promise.allSettled([
      getBridgeState(),
      qdnRequest<HostInfo>({ action: 'GET_HOST_INFO' }),
      qdnRequest<{ address?: string }>({ action: 'GET_SELECTED_ACCOUNT' }),
    ]);

    if (bridgeResult.status === 'fulfilled') {
      setBridge(bridgeResult.value);
    } else {
      console.error('Failed to load bridge context', bridgeResult.reason);
      setMessage({ text: translate('error.default'), tone: 'error' });
    }

    setHost(hostResult.status === 'fulfilled' ? hostResult.value : null);
    setAccount(accountResult.status === 'fulfilled' ? accountResult.value.address ?? '' : '');
  }

  async function loadPolls(
    nextOffset = offset,
    filters: Filters = { query, owner, status, reverse },
    destination: 'browse' | 'mine' = 'browse',
  ) {
    const setDestinationPolls = destination === 'mine' ? setMyPolls : setPolls;
    const setDestinationLoading = destination === 'mine' ? setLoadingMine : setLoading;
    const setDestinationLoaded = destination === 'mine' ? setMyPollsLoaded : setPollsLoaded;
    const requestRef = destination === 'mine' ? mineRequestRef : browseRequestRef;
    const resultKeyRef = destination === 'mine' ? mineResultKeyRef : browseResultKeyRef;
    const requestId = requestRef.current + 1;
    const requestKey = JSON.stringify({
      offset: nextOffset,
      owner: filters.owner.trim(),
      query: filters.query.trim(),
      reverse: filters.reverse ?? reverse,
      status: filters.status,
    });
    requestRef.current = requestId;

    setDestinationLoading(true);
    setDestinationLoaded(false);
    setMessage(null);

    if (resultKeyRef.current !== requestKey) {
      setDestinationPolls([]);
    }

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
      if (requestRef.current !== requestId) {
        return;
      }

      resultKeyRef.current = requestKey;
      setDestinationPolls(Array.isArray(result) ? result : []);
      setDestinationLoaded(true);

      if (destination === 'browse') {
        setOffset(nextOffset);
      }
    } catch (error) {
      console.error('Failed to load polls', error);

      if (requestRef.current === requestId) {
        setMessage({ text: translate('error.loadPolls'), tone: 'error' });
      }
    } finally {
      if (requestRef.current === requestId) {
        setDestinationLoading(false);
      }
    }
  }

  function syncPollRoute(pollId: number | null, historyMode: Exclude<HistoryMode, 'none'>) {
    window.history[historyMode === 'replace' ? 'replaceState' : 'pushState'](
      window.history.state,
      '',
      getPollRouteUrl(pollId),
    );
  }

  function closePoll(historyMode: Exclude<HistoryMode, 'none'> = 'replace') {
    openRequestRef.current += 1;
    setSelected(null);
    setVotes(null);
    setVotesLoading(false);
    setDirectLinkState('none');
    setMessage(null);
    syncPollRoute(null, historyMode);
  }

  async function openPoll(poll: Poll, historyMode: HistoryMode = 'push') {
    const requestId = openRequestRef.current + 1;
    const isRefreshingSelectedPoll = selectedRef.current?.pollId === poll.pollId;
    openRequestRef.current = requestId;
    setMessage(null);
    setSelected(poll);
    if (!isRefreshingSelectedPoll) {
      setVotes(null);
    }
    setVotesLoading(true);
    setTab('browse');

    if (historyMode !== 'none') {
      syncPollRoute(poll.pollId, historyMode);
    }

    try {
      const result = responseData<PollVotes>(await qdnRequest({
        action: 'FETCH_NODE_API',
        path: `/polls/votes/id/${poll.pollId}?onlyCounts=false`,
        maxBytes: 2_000_000,
      }));

      if (openRequestRef.current === requestId && selectedRef.current?.pollId === poll.pollId) {
        setVotes(result);
        setVotesLoading(false);
      }
    } catch (error) {
      console.error('Failed to load poll results', error);

      if (openRequestRef.current === requestId && selectedRef.current?.pollId === poll.pollId) {
        setMessage({ text: translate('error.loadResults'), tone: 'error' });
        setVotesLoading(false);
      }
    }
  }

  async function openPollById(pollId: number, historyMode: HistoryMode = 'none') {
    setDirectLinkState('loading');

    try {
      const poll = responseData<Poll>(await qdnRequest({
        action: 'FETCH_NODE_API',
        path: `/polls/id/${pollId}`,
        maxBytes: 100_000,
      }));

      setDirectLinkState('none');
      await openPoll(poll, historyMode);
    } catch (error) {
      console.error('Failed to load linked poll', error);
      const detail = errorText(error, '');
      setDirectLinkState(/POLL_NO_EXISTS|poll does not exist/i.test(detail) ? 'not-found' : 'error');
    }
  }

  useEffect(() => {
    // Poll reads do not depend on account or host context. Start them
    // immediately so a deep link is not held behind several bridge calls.
    void loadContext();

    if (initialPollRoute.kind === 'poll') {
      void openPollById(initialPollRoute.pollId);
    }

    void loadPolls(0);
  }, []);

  useEffect(() => {
    function onPopState() {
      const route = getCurrentPollRoute();

      if (route.kind === 'poll') {
        void openPollById(route.pollId, 'none');
      } else if (route.kind === 'invalid') {
        openRequestRef.current += 1;
        setSelected(null);
        setVotes(null);
        setVotesLoading(false);
        setDirectLinkState('invalid');
      } else {
        openRequestRef.current += 1;
        setSelected(null);
        setVotes(null);
        setVotesLoading(false);
        setDirectLinkState('none');
        setMessage(null);
      }
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function refresh() {
    void loadContext();
    void loadPolls(offset);

    if (selected) {
      void openPoll(selected, 'none');
    }
  }

  async function submitVote(indexes: number[]) {
    if (!selected || (pendingVote && (pendingVote.phase === 'signing' || pendingVote.phase === 'pending'))) {
      return;
    }

    setBusy(true);
    setMessage(null);

    const validation = validateVoteIndexes({
      optionCount: selected.pollOptions.length,
      optionIndexes: supports142 ? indexes : undefined,
      optionIndex: supports142 ? undefined : indexes[0] ?? 0,
      previousIndexes: getAccountVoteIndexes(votes, account),
    });

    if (!validation.ok) {
      setMessage({ text: translate(validationMessageKey(validation.code)), tone: 'error' });
      setBusy(false);
      return;
    }

    // Core's repository returns option indexes sorted ascending when it
    // re-serializes the transaction for block inclusion, so an unsorted
    // submission breaks its own signature and can never confirm. Always
    // submit in ascending order.
    const orderedIndexes = sortedIndexes(indexes);

    setPendingVote({
      pollId: selected.pollId,
      indexes: orderedIndexes,
      phase: 'signing',
      submittedAt: Date.now(),
    });

    try {
      const result = await qdnRequest<{ transactionSignature?: string } | undefined>({
        action: 'VOTE_ON_POLL',
        pollId: selected.pollId,
        ...(supports142 ? { optionIndexes: orderedIndexes } : { optionIndex: orderedIndexes[0] ?? 0 }),
      });
      setPendingVote((current) => current && {
        ...current,
        phase: 'pending',
        signature: typeof result?.transactionSignature === 'string' ? result.transactionSignature : undefined,
        submittedAt: Date.now(),
      });
    } catch (error) {
      setPendingVote(null);
      const rejectionKey = coreRejectionKey(error);
      setMessage({
        text: rejectionKey
          ? translate(rejectionKey)
          : friendlyWriteError(error, lockedNote || translate('node.publicReadOnly')),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  // Watches the submitted vote until the network records it, then refreshes
  // the open poll automatically.
  useEffect(() => {
    if (!pendingVote || pendingVote.phase !== 'pending') {
      return;
    }

    let disposed = false;
    let timer = 0;
    const watched = pendingVote;

    function confirm() {
      if (disposed) {
        return;
      }

      setPendingVote((current) => current && current.submittedAt === watched.submittedAt
        ? { ...current, phase: 'confirmed' }
        : current);

      if (selectedRef.current?.pollId === watched.pollId) {
        void openPoll(selectedRef.current, 'none');
      }

      window.setTimeout(() => {
        setPendingVote((current) => current && current.submittedAt === watched.submittedAt ? null : current);
      }, VOTE_CONFIRMED_LINGER_MS);
    }

    async function check() {
      if (disposed) {
        return;
      }

      try {
        if (watched.signature) {
          const transaction = responseData<{ blockHeight?: number }>(await qdnRequest({
            action: 'FETCH_NODE_API',
            path: `/transactions/signature/${encodeURIComponent(watched.signature)}`,
            maxBytes: 100_000,
          }));

          if (typeof transaction?.blockHeight === 'number' && transaction.blockHeight > 0) {
            confirm();
            return;
          }
        } else {
          // Older hosts do not return the transaction signature; watch the
          // stored votes for this account instead.
          const result = responseData<PollVotes>(await qdnRequest({
            action: 'FETCH_NODE_API',
            path: `/polls/votes/id/${watched.pollId}?onlyCounts=false`,
            maxBytes: 2_000_000,
          }));
          const stored = getAccountVoteIndexes(result, account);
          const recorded = watched.indexes.length === 0 ? stored.length === 0 : sameIndexes(stored, watched.indexes);

          if (recorded) {
            confirm();
            return;
          }
        }
      } catch {
        // Not found yet or a transient network error — keep polling.
      }

      if (disposed) {
        return;
      }

      if (Date.now() - watched.submittedAt > VOTE_WATCH_TIMEOUT_MS) {
        setPendingVote((current) => current && current.submittedAt === watched.submittedAt
          ? { ...current, phase: 'timeout' }
          : current);
        return;
      }

      const interval = Date.now() - watched.submittedAt < VOTE_WATCH_FAST_WINDOW_MS
        ? VOTE_WATCH_FAST_MS
        : VOTE_WATCH_SLOW_MS;
      timer = window.setTimeout(() => void check(), interval);
    }

    timer = window.setTimeout(() => void check(), VOTE_WATCH_FAST_MS);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [pendingVote?.phase, pendingVote?.signature]);

  async function submitCreate(request: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);

    try {
      await qdnRequest({ action: 'CREATE_POLL', ...request });
      setMessage({ text: translate('status.submittedCreate'), tone: 'info' });
    } catch (error) {
      const rejectionKey = coreRejectionKey(error);
      setMessage({
        text: rejectionKey
          ? translate(rejectionKey)
          : friendlyWriteError(error, lockedNote || translate('node.publicReadOnly')),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitUpdate(request: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);

    try {
      await qdnRequest({ action: 'UPDATE_POLL', ...request });
      setMessage({ text: translate('status.submittedUpdate'), tone: 'info' });
    } catch (error) {
      const rejectionKey = coreRejectionKey(error);
      setMessage({
        text: rejectionKey
          ? translate(rejectionKey)
          : friendlyWriteError(error, lockedNote || translate('node.publicReadOnly')),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  if (directLinkState !== 'none') {
    const errorKey = directLinkState === 'invalid'
      ? 'error.invalidPollLink'
      : directLinkState === 'not-found'
        ? 'error.pollNotFound'
        : 'error.loadPoll';

    return (
      <main className="app-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">{translate('app.eyebrow', { version: __APP_VERSION__ })}</p>
            <h1>{translate('app.title')}</h1>
          </div>
        </header>
        {directLinkState === 'loading' ? (
          <div className="empty-state">
            <Loader2 className="spinner" />
            {translate('label.loadingPoll')}
          </div>
        ) : (
          <section className="card linked-poll-error">
            <Notice tone="error">{translate(errorKey)}</Notice>
            <button
              onClick={() => {
                closePoll();
              }}
            >
              {translate('action.browsePolls')}
            </button>
          </section>
        )}
      </main>
    );
  }

  if (selected) {
    return (
      <PollDetail
        poll={selected}
        votes={votes}
        voterIdentities={voterIdentities}
        votesLoading={votesLoading}
        account={account}
        language={settings.language}
        supports142={supports142}
        writeAvailable={writeAvailable}
        lockedNote={lockedNote}
        busy={busy}
        message={message?.tone === 'error' ? message.text : ''}
        pendingVote={pendingVote}
        shareAddress={buildPollLink(selected.pollId)}
        translate={translate}
        onBack={() => closePoll()}
        onRefresh={() => void openPoll(selected, 'none')}
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
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {tab === 'browse' && (
        <BrowsePolls
          polls={polls}
          loaded={pollsLoaded}
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
          loaded={myPollsLoaded}
          loading={loadingMine}
          language={settings.language}
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
