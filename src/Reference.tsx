// Intentionally outside the i18n catalog: this is an always-English protocol reference.
import { useState } from 'react';
import { Copy } from 'lucide-react';

export function Reference({ supports142 }: { supports142: boolean }) {
  const [copied, setCopied] = useState('');
  const snippets = {
    create: [
      "await qdnRequest({ action: 'CREATE_POLL', pollName: 'Example poll', ",
      "description: 'Optional', pollOptions: ['Yes', 'No'], ",
      supports142 ? 'startTime: Date.now() + 60_000, ' : '',
      'endTime: Date.now() + 86_400_000 });',
    ].join(''),
    vote: [
      "await qdnRequest({ action: 'VOTE_ON_POLL', pollId: 42, ",
      supports142 ? 'optionIndexes: [1, 3]' : 'optionIndex: 1',
      ' });',
    ].join(''),
    update: [
      "await qdnRequest({ action: 'UPDATE_POLL', pollId: 42, newPollName: 'Example poll', ",
      "newDescription: 'Optional', newPollOptions: ['Yes', 'No'], ",
      supports142 ? 'newStartTime: existingStartTime, ' : '',
      'newEndTime: extendedEndTime });',
    ].join(''),
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
                    pollName 3–400 UTF-8 bytes, Core-normalized (NFKC plus safe whitespace/invisible handling), globally unique;
                    description ≤4000; 2–1000 exact-unique options, 1–400 bytes; future start/end and start &lt; end.
                  </td>
                </tr>
                <tr>
                  <td>VOTE_ON_POLL</td>
                  <td>stable numeric pollId; mutable vote/account; indexes 1-based; 0, [0], and [] remove.</td>
                </tr>
                <tr>
                  <td>UPDATE_POLL</td>
                  <td>owner full replacement before votes; after votes only extend an existing future end; closed polls immutable; no delete.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
        <article className="card">
          <h3>Read endpoints</h3>
          <code>GET /polls?limit&amp;offset&amp;reverse</code>
          <code>GET /polls/search?query&amp;prefixOnly&amp;owner&amp;status=ALL|OPEN|CLOSED&amp;hasEndTime&amp;fromTimestamp&amp;toTimestamp&amp;limit&amp;offset&amp;reverse</code>
          <code>GET /polls/id/{'{pollId}'}</code>
          <code>GET /polls/{'{pollName}'}</code>
          <code>GET /polls/votes/id/{'{pollId}'}?onlyCounts</code>
          <code>GET /polls/votes/{'{pollName}'}?onlyCounts</code>
        </article>
        <article className="card">
          <h3>Weights and results</h3>
          <p>
            Each option returns count plus raw (<code>blocksMinted</code>) and effective weight. Previewnet effective percent:
            GOLD 100, SILVER 70, BRONZE 40, UNVERIFIED/SUSPICIOUS 0. <code>totalVotes</code> counts selections;
            <code>totalVoters</code> counts accounts. Closed results are frozen at close.
          </p>
        </article>
        <article className="card">
          <h3>Bridge, QAVS, and feature detection</h3>
          <p>
            Write actions trigger Home approval: CREATE_POLL, VOTE_ON_POLL, UPDATE_POLL. Reads use FETCH_NODE_API without approval.
            Inspect QAVS/available actions with SHOW_ACTIONS, then call GET_HOST_INFO; require Home 1.4.2 for <code>startTime</code>,
            <code>newStartTime</code>, and <code>optionIndexes</code>. A thrown host-info request means old host. Public nodes are browse-only:
            call IS_USING_PUBLIC_NODE.
          </p>
          {(Object.entries(snippets) as [keyof typeof snippets, string][]).map(([key, snippet]) => (
            <div key={key}>
              <pre>{snippet}</pre>
              <button className="minor-button" onClick={() => void copy(key, snippet)}>
                <Copy size={15} />
                {copied === key ? 'Copied' : `Copy ${key} snippet`}
              </button>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}
