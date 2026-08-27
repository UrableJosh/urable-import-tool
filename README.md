# Urable Data Import Tool

Internal migration tool for onboarding shops into Urable: customers, products &
services, and jobs history.

**Live:** https://urable-import-tool.vercel.app — the team always gets the latest
version, no downloads.

## How it works
Single self-contained `index.html`. All file parsing happens in the browser;
customer files never leave the user's machine. Direct-to-Urable import uses the
account's own API key, entered at runtime and never stored.

## Updating
Replace `index.html` on the `main` branch and Vercel redeploys automatically
(~20 seconds). Users just refresh — no version to distribute.

Two ways to push a change:

- **From a Claude session:** `T=<github_pat> node ../push.mjs "message"`, run from
  the repo root. Uses the GitHub Git Data API (`git push` is blocked in that
  sandbox). Guards refuse the push if `index.html` or `README.md` is missing, or
  if `index.html` is under 90KB — the tree is built without a `base_tree`, so it
  replaces the branch wholesale.
- **By hand:** **Add file ▾ → Upload files**, drag the new `index.html` in, and
  commit. A file dropped with an existing name overwrites it in that commit.
  Don't paste into the web editor — the file is ~110KB.

After either, wait 60–90s, then verify with a cache-busted URL
(`...vercel.app/?v=<sha>`).

## Supported formats
- **Customers:** Jobber, Shopmonkey (incl. Fleet), Fieldd, Square, EBMS,
  GoHighLevel, TintWiz, Detail Bookie, HubSpot, Stripe, Mobile Tech RX,
  Urable customer export,
  QuickBooks-style, Urable template, plus a column mapper for anything else.
- **Products/Services:** Jobber, Square catalog, Housecall Pro, Urable template
  (current + legacy single-price), tiered-variant sheets, generic services sheets.
- **Jobs:** Urable jobs export, Detail Bookie all-jobs export.

## Notes
- Jobs import runs phased: scan/match existing → customers → services →
  vehicles → jobs → historical payments.
- The scan phase makes re-runs safe: already-imported jobs are skipped by
  signature (customer + start + subtotal), so a partial run is finished by
  re-importing the same file.
- The tool never edits an existing catalog entry. A matched service that lacks
  needed price points gets a companion `<name> (imported)` in the Imported
  category instead.
- API key needs scopes: `customers:write`, `items:write`, `products:write`,
  `jobs:write`, `payments:write` (plus read scopes for matching).


## Walkthrough

A 15-step interactive CS guide lives at `/walkthrough/`, step script at `/walkthrough/script.json`.
