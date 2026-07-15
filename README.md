# Qortium Polls

A QDN app for browsing, creating, managing, and voting on Qortium on-chain polls. It also carries a compact, always-English developer reference for the `CREATE_POLL`, `VOTE_ON_POLL`, and `UPDATE_POLL` contracts.

## Development

Dependencies are supplied with this checkout. Run locally:

```sh
npm run dev -- --host 127.0.0.1
```

Build and test:

```sh
npm run build
npm test
```

The browser fallback reads a local Core at `http://127.0.0.1:24891` (override with `VITE_QORTIUM_NODE_API_URL`). It is deliberately read-only.

## Qortium Home Smoke Check

Open `qdn://APP/Polls/Polls` in Home. Browse polls and open a result detail. With a selected, unlocked account, Home should approve `CREATE_POLL`, `VOTE_ON_POLL`, and `UPDATE_POLL` on trusted local/custom nodes and on compatible public nodes. Public-node writes use unsigned Core builders, strict client-side validation, bounded local MemoryPoW, and local signing; the private key never leaves Home. Proof of work can take up to three minutes, and older public nodes remain browse-only. Home 1.4.2 enables scheduled starts and multi-option votes.

## Publishing

`npm run qdn:publish` builds and publishes `dist/` as `qdn://APP/Polls/Polls`. It expects the local Previewnet Core and account files under `~/qortium/git/qortium-core/preview/` by default. Override any value explicitly when needed:

- `QORTIUM_POLLS_NODE_API_URL`
- `QORTIUM_POLLS_QDN_NAME`, `QORTIUM_POLLS_QDN_IDENTIFIER`, `QORTIUM_POLLS_QDN_TITLE`, `QORTIUM_POLLS_QDN_SERVICE`
- `QORTIUM_POLLS_DIST_PATH`
- `QORTIUM_POLLS_NODE_API_KEY` or `QORTIUM_POLLS_NODE_API_KEY_PATH`
- `QORTIUM_POLLS_PREVIEW_ACCOUNTS_PATH`

Publishing is an explicit operator action; builds and tests never publish.

## Current Limits

Poll names are 3–400 UTF-8 bytes; descriptions are at most 4000; polls have 2–1000 unique options of 1–400 bytes each. Validation here mirrors Core but Core remains authoritative.
