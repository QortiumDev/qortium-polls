// Intentionally outside the i18n catalog: this is an always-English protocol reference.
import { useState } from 'react';
import { Copy } from 'lucide-react';

export function Reference({ supports142 }: { supports142: boolean }) {
  const [copied, setCopied] = useState('');
  const snippets = {
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
      supports142 ? '  optionIndexes: [1, 3],' : '  optionIndex: 1,',
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

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied('unavailable');
    }
  }

  return (
    <section className="workspace reference">
      <h2>Developer Reference</h2>
      <p>
        Always-English protocol reference. Core is authoritative; client validation is a fast preflight.
      </p>
      <div className="reference-grid">
        <article className="card">
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
                      <li>pollName: 3–400 UTF-8 bytes, Core-normalized (NFKC plus safe whitespace/invisible handling), globally unique</li>
                      <li>description: up to 4000 bytes</li>
                      <li>options: 2–1000, each 1–400 bytes, exact-unique</li>
                      <li>startTime/endTime: in the future, start before end</li>
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
        <article className="card">
          <h3>Read endpoints</h3>
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
        <article className="card">
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
        <article className="card">
          <h3>Bridge, QAVS, and feature detection</h3>
          <ul>
            <li>Write actions trigger Home approval: CREATE_POLL, VOTE_ON_POLL, UPDATE_POLL. Reads use FETCH_NODE_API without approval.</li>
            <li>Inspect available actions with SHOW_ACTIONS, then call GET_HOST_INFO. If GET_HOST_INFO throws, treat the host as older than 1.4.2.</li>
            <li>Home 1.4.2 or newer is required for <code>startTime</code>, <code>newStartTime</code>, and <code>optionIndexes</code>.</li>
            <li>On compatible public nodes, Home builds through <code>/polls/public/*</code>, validates the returned bytes, computes bounded MemoryPoW, and signs locally.</li>
            <li>Older public nodes remain browse-only; call IS_USING_PUBLIC_NODE and trust SHOW_ACTIONS for action availability.</li>
          </ul>
          {(Object.entries(snippets) as [keyof typeof snippets, string][]).map(([key, snippet]) => (
            <div key={key} className="snippet">
              <div className="snippet-head">
                <span>{key}</span>
                <button className="minor-button" onClick={() => void copy(key, snippet)}>
                  <Copy size={15} />
                  {copied === key ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre>{snippet}</pre>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}
