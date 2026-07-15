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

Open `qdn://APP/Polls/Polls` in Home. Browse polls and open a result detail. On a trusted local/custom node with a selected account, Home should approve `CREATE_POLL`, `VOTE_ON_POLL`, and `UPDATE_POLL`. Public-network nodes remain browse-only. Home 1.4.2 enables scheduled starts and multi-option votes.

## Current Limits

Poll names are 3–400 UTF-8 bytes; descriptions are at most 4000; polls have 2–1000 unique options of 1–400 bytes each. Validation here mirrors Core but Core remains authoritative. Publishing is intentionally not run by this app's development workflow.
