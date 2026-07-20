# Changelog

## 1.5.9 - 2026-07-19

- Added the app icon (result-bars proto-icon) and wired `favicon.ico` so the
  app displays a proper tile icon in Qortium Home.

## 1.5.8 - 2026-07-18

- Show voter avatars and prefer primary or first registered names in poll vote
  details, while keeping the account address as the fallback and audit context.
- Batch Home identity resolution in groups of 500 and use bounded fallback
  lookups without delaying the poll results themselves.

## 1.5.7 - 2026-07-18

- Preserve Home bridge and display query parameters, along with the current URL
  fragment, when opening another poll or returning to Browse.

## 1.5.6 - 2026-07-18

- Show explicit loading states instead of temporary empty poll lists or zero
  vote totals, and preserve confirmed results during same-request refreshes.
- Start independent poll, direct-link, and Home-context reads concurrently
  while guarding searches and result loads against stale responses.
- Keep the in-app poll route synchronized when opening another poll, returning
  to Browse, or navigating through browser history.

## 1.5.5 - 2026-07-16

- Replaced fixed centered page widths with responsive full-window layouts.
- Kept Modern's intentionally wider gutter while giving Classic and Fun more
  usable horizontal space.
- Reserved stable scrollbar space so the app header no longer shifts between
  Browse, My Polls, Create Poll, and Developers.
