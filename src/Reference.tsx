// Intentionally outside the i18n catalog: this is an always-English protocol reference.
import { useState } from 'react';
import { ReferenceNavigation } from './ReferenceNavigation';
import { Copy } from 'lucide-react';
import { copyTextToClipboard } from './clipboard';
import { VOTE_WATCH_TIMEOUT_MS } from './pollConstants';
import { POLL_LIMITS } from './pollValidation';
import { POLL_PAGE_SIZE } from './BrowsePolls';

export function getPollReferenceExamples(supports142: boolean) {
  return {
    capabilities: "const actions = await qdnRequest({ action: 'SHOW_ACTIONS' });\n// Offer a write only when its action is advertised; Home still requires approval.",
    read: `const response = await qdnRequest({ action: 'FETCH_NODE_API', path: '/polls/search?status=ALL&limit=${POLL_PAGE_SIZE}&offset=0&reverse=true' });\nif (!response.ok) throw new Error(response.body);\nconst polls = response.data;`,
    confirmation: "const response = await qdnRequest({ action: 'FETCH_NODE_API', path: `/transactions/signature/${signature}` });\nif (!response.ok) throw new Error(response.body);\nconst confirmed = response.data.blockHeight > 0;\n// An unconfirmed or timed-out result is not proof of failure; reconcile before retrying.",
    create: [
      'await qdnRequest({',
      "  action: 'CREATE_POLL',",
      "  pollName: 'Example poll',",
      "  description: 'Optional',",
      "  pollOptions: ['Yes', 'No'],",
      ...(supports142 ? ['  startTime: Date.now() + 60_000,'] : []),
      '  endTime: Date.now() + 86_400_000,',
      '});',
    ].join('\n'),
    vote: [
      'await qdnRequest({',
      "  action: 'VOTE_ON_POLL',",
      '  pollId: 42,',
      supports142 ? '  optionIndexes: [1, 2],' : '  optionIndex: 1,',
      '});',
    ].join('\n'),
    update: [
      'await qdnRequest({',
      "  action: 'UPDATE_POLL',",
      '  pollId: 42,',
      "  newPollName: 'Example poll',",
      "  newDescription: 'Optional',",
      "  newPollOptions: ['Yes', 'No'],",
      ...(supports142 ? ['  newStartTime: existingStartTime,'] : []),
      '  newEndTime: extendedEndTime,',
      '});',
    ].join('\n'),
  };
}

export function Reference({ supports142 }: { supports142: boolean }) {
  const [copied, setCopied] = useState('');
  const snippets = getPollReferenceExamples(supports142);

  async function copy(key: string, text: string, button: HTMLButtonElement) {
    setCopied(await copyTextToClipboard(text) ? key : 'unavailable');
    button.focus({ preventScroll: true });
  }

  return (
    <section className="workspace reference" lang="en" dir="ltr">
      <h2>Developer Reference</h2>
      <p>
        Qortium poll transaction contract, QAVS 1.5. Always-English protocol reference. Core is authoritative; client validation is a fast preflight.
      </p>
      <ReferenceNavigation />
      <p role="status" aria-live="polite" className="copy-status">{copied === 'unavailable' ? 'Clipboard unavailable. Select the code and copy it manually.' : copied ? `Copied ${copied} example.` : 'Code examples can be selected for manual copying.'}</p>
      <div className="reference-scroll" role="region" aria-label="Developer reference content" tabIndex={0}>
      <div className="reference-grid">
        <article className="card" id="reference-contract" tabIndex={-1}>
          <h3>Transactions and validation</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Fields and Core rule</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>CREATE_POLL</td>
                  <td>
                    <ul>
                      <li>pollName: {POLL_LIMITS.minNameBytes}–{POLL_LIMITS.maxNameBytes} UTF-8 bytes, Core-normalized (NFKC plus safe whitespace/invisible handling), globally unique</li>
                      <li>description: up to {POLL_LIMITS.maxDescriptionBytes} UTF-8 bytes</li>
                      <li>options: {POLL_LIMITS.minOptions}–{POLL_LIMITS.maxOptions}, each {POLL_LIMITS.minOptionBytes}–{POLL_LIMITS.maxOptionBytes} UTF-8 bytes, exact-unique</li>
                      <li>Optional startTime/endTime: epoch milliseconds in the future, start before end when both are supplied</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td>VOTE_ON_POLL</td>
                  <td>
                    <ul>
                      <li>pollId is stable and numeric; the vote is mutable per account</li>
                      <li>indexes are 1-based; 0, [0], and [] remove the vote</li>
                      <li>
                        send <code>optionIndexes</code> sorted ascending — Core re-serializes stored votes in
                        ascending order, so an unsorted multi-option submission breaks its own signature and
                        never confirms
                      </li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td>UPDATE_POLL</td>
                  <td>
                    <ul>
                      <li>owner-only, full replacement before any votes exist</li>
                      <li>after votes: only extend an existing future end time</li>
                      <li>closed polls are immutable; there is no delete</li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
        <article className="card" id="reference-reads" tabIndex={-1}>
          <h3>Read endpoints</h3>
          <p>Browse/search requests use {POLL_PAGE_SIZE} items per page with offset paging. Poll data is on-chain, not an app-owned QDN JSON schema. Poll names, options, votes and account addresses are public and durable; there is no private voting mode.</p>
          <code className="endpoint">GET /polls?limit&amp;offset&amp;reverse</code>
          <code className="endpoint">GET /polls/search?query&amp;prefixOnly&amp;owner&amp;status=ALL|OPEN|CLOSED&amp;hasEndTime&amp;fromTimestamp&amp;toTimestamp&amp;limit&amp;offset&amp;reverse</code>
          <code className="endpoint">GET /polls/id/{'{pollId}'}</code>
          <code className="endpoint">GET /polls/{'{pollName}'}</code>
          <code className="endpoint">GET /polls/votes/id/{'{pollId}'}?onlyCounts</code>
          <code className="endpoint">GET /polls/votes/{'{pollName}'}?onlyCounts</code>
          <code className="endpoint">GET /transactions/signature/{'{signature}'}</code>
          <p>
            The last endpoint is how this app watches a submitted vote: <code>blockHeight</code> appears in the
            response once the transaction is confirmed.
          </p>
        </article>
        <article className="card" id="reference-results" tabIndex={-1}>
          <h3>Weights and results</h3>
          <p>
            Each option returns a count plus a raw weight (<code>blocksMinted</code>) and an effective weight.
            Previewnet effective percent: GOLD 100, SILVER 70, BRONZE 40, UNVERIFIED/SUSPICIOUS 0.
          </p>
          <p>
            <code>totalVotes</code> counts selections; <code>totalVoters</code> counts accounts.
            Closed results are frozen at close.
          </p>
        </article>
        <article className="card" id="reference-bridge" tabIndex={-1}>
          <h3>Bridge, QAVS, and feature detection</h3>
          <ul>
            <li>Write actions trigger Home approval: CREATE_POLL, VOTE_ON_POLL, UPDATE_POLL. Reads use FETCH_NODE_API without approval.</li>
            <li>Inspect SHOW_ACTIONS for action availability. This app uses GET_HOST_INFO only to select legacy field compatibility; if unavailable, scheduled-start and multi-option fields are omitted. A host version never grants write authority.</li>
            <li>Legacy field compatibility began in Home 1.4.2 for <code>startTime</code>, <code>newStartTime</code>, and <code>optionIndexes</code>.</li>
            <li>On compatible public nodes, Home builds through <code>/polls/public/*</code>, validates the returned bytes, computes bounded MemoryPoW, and signs locally.</li>
            <li>Older public nodes remain browse-only. IS_USING_PUBLIC_NODE describes the node mode; SHOW_ACTIONS determines advertised actions. The selected account must be unlocked and Home must approve each write. Plain-browser development is read-only.</li>
          </ul>
          <p>The app watches votes for up to {VOTE_WATCH_TIMEOUT_MS / 60_000} minutes. Submission returns a signature, not confirmation. A timeout leaves the outcome unknown; check transaction and vote state before resubmitting. CREATE_POLL and UPDATE_POLL responses likewise need authoritative verification.</p>
          <p>Open <code>?view=developers</code> for this workspace; <code>view=developer</code> and <code>view=reference</code> are read aliases. A recognized Developers view takes precedence over <code>tab=create|mine</code> and a numeric poll path. The poll path is retained while visiting Developers; returning to Browse restores it. Home parameters, repeated unknown keys and fragments survive navigation.</p>
          {(Object.entries(snippets) as [keyof typeof snippets, string][]).map(([key, snippet]) => (
            <div key={key} className="snippet">
              <div className="snippet-head">
                <span>{key}</span>
                <button className="minor-button" type="button" aria-label={`Copy ${key} example`} onClick={event => void copy(key, snippet, event.currentTarget)}>
                  <Copy size={15} />
                  {copied === key ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre aria-label={`${key} example`} tabIndex={0}>{snippet}</pre>
            </div>
          ))}
        </article>
      </div>
      </div>
    </section>
  );
}
