import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getBridgeState, qdnRequest } from './qdnRequest';
import type { BridgeState, NodeStatus, QdnResource } from './types';

const APP_TITLE = 'Polls';

function formatStatus(status: NodeStatus | null) {
  if (!status) {
    return 'Unavailable';
  }

  if (typeof status.syncPercent === 'number') {
    return `${status.syncPercent}% synced`;
  }

  if (typeof status.syncPhase === 'string') {
    return status.syncPhase;
  }

  return 'Connected';
}

function getResourceKey(resource: QdnResource, index: number) {
  return `${resource.service ?? 'APP'}:${resource.name ?? 'unknown'}:${resource.identifier ?? index}`;
}

function getResourceTitle(resource: QdnResource) {
  return resource.title || resource.identifier || resource.name || 'Untitled resource';
}

export function App() {
  const [bridgeState, setBridgeState] = useState<BridgeState | null>(null);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [resources, setResources] = useState<QdnResource[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const statusLabel = useMemo(() => formatStatus(nodeStatus), [nodeStatus]);

  async function refresh() {
    setIsLoading(true);
    setError('');

    try {
      const [state, status] = await Promise.all([
        getBridgeState(),
        qdnRequest<NodeStatus>({ action: 'GET_NODE_STATUS' }),
      ]);

      setBridgeState(state);
      setNodeStatus(status);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setIsLoading(false);
    }
  }

  async function searchResources(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError('');

    try {
      const result = await qdnRequest<unknown>({
        action: 'SEARCH_QDN_RESOURCES',
        includeMetadata: true,
        includeStatus: true,
        limit: 12,
        mode: 'ALL',
        query,
        service: 'APP',
      });

      setResources(Array.isArray(result) ? (result as QdnResource[]) : []);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : String(searchError));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (bridgeState) {
      searchResources();
    }
  }, [bridgeState]);

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Qortium QDN</p>
            <h1>{APP_TITLE}</h1>
          </div>
          <button className="icon-button" type="button" onClick={refresh} aria-label="Refresh node status">
            Refresh
          </button>
        </header>

        <div className="status-grid">
          <article className="panel">
            <span className="panel-label">Runtime</span>
            <strong>{bridgeState?.ui ?? 'Detecting'}</strong>
            <span>{bridgeState?.isHomeBridge ? 'Qortium Home bridge' : 'Local browser fallback'}</span>
          </article>
          <article className="panel">
            <span className="panel-label">Node</span>
            <strong>{statusLabel}</strong>
            <span>
              Height {typeof nodeStatus?.height === 'number' ? nodeStatus.height.toLocaleString() : 'unknown'}
            </span>
          </article>
          <article className="panel">
            <span className="panel-label">Actions</span>
            <strong>{bridgeState?.actions.length ?? 0}</strong>
            <span>available bridge actions</span>
          </article>
        </div>

        {error ? <div className="notice">{error}</div> : null}
        {isLoading ? <div className="notice muted">Loading node context...</div> : null}

        <section className="resource-section">
          <div className="section-heading">
            <div>
              <h2>QDN Apps</h2>
              <p>Search published APP resources from the active Qortium node.</p>
            </div>
          </div>

          <form className="search-row" onSubmit={searchResources}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, title, or keyword"
              aria-label="Search QDN apps"
            />
            <button type="submit">Search</button>
          </form>

          <div className="resource-list">
            {resources.map((resource, index) => (
              <article className="resource-item" key={getResourceKey(resource, index)}>
                <div>
                  <strong>{getResourceTitle(resource)}</strong>
                  <span>
                    qdn://{resource.service ?? 'APP'}/{resource.name ?? 'unknown'}
                    {resource.identifier ? `/${resource.identifier}` : ''}
                  </span>
                </div>
                <span className="status-pill">{resource.status ?? 'listed'}</span>
              </article>
            ))}
            {!resources.length ? <div className="empty-state">No APP resources loaded.</div> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
