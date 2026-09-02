# Urable Data Import Tool

Internal migration tool for onboarding shops into Urable: customers, products &
services, and jobs history — plus copying one Urable account into another.

**Live:** https://urable-import-tool.vercel.app — the team always gets the latest
version, no downloads.

**Walkthrough:** https://urable-import-tool.vercel.app/walkthrough/ — a 23-step
interactive guide for the CS team. Step script at `/walkthrough/script.json`.

## How it works
Single self-contained `index.html`. All file parsing happens in the browser;
customer files never leave the user's machine. Direct-to-Urable import uses the
account's own API key, entered at runtime and never stored. The `BUILD` stamp
shows in the UI and as the first log line — check it before debugging a
suspected stale cache.

## The four sections
1. **Customers** — CSV download or direct API import.
2. **Products & Services** — tiered/variant menus grouped into one service with
   multiple price points.
3. **Jobs history** — customers, services, vehicles, jobs and historical
   payments in one phased pass.
4. **Copy one account into another** — source and destination API keys, a
   read-only preview, then the copy. Non-GET calls against the source are
   refused, and the copy will not run without a preview.

## Migration order — settled, don't re-litigate
**Customers → Products/Services → Jobs**, as three passes. Building a catalog
out of a jobs list does not work: a jobs export is service names and prices as
typed over several years, not a price book. The jobs pass should bind to a
catalog that already exists. Unmatched services land in a single **Imported**
category the shop can delete in one action.

## Updating
Two ways to push a change:

- **From a Claude session:** `T=<github_pat> node ../push.mjs "message"`, run from
  the repo root. Uses the GitHub Git Data API (`git push` is blocked in that
  sandbox). Guards refuse the push if a required file is missing, or if
  `index.html` is under 90KB — the tree is built without a `base_tree`, so it
  replaces the branch wholesale.
- **By hand:** **Add file ▾ → Upload files**, drag the new `index.html` in, and
  commit. Don't paste into the web editor — the file is ~185KB.

After either, wait 60–90s, then verify with a cache-busted URL
(`...vercel.app/?v=<sha>`) and confirm the `BUILD` stamp changed.

## Supported formats
- **Customers:** Jobber, Shopmonkey (incl. Fleet), Fieldd, Square, EBMS,
  GoHighLevel, TintWiz, Detail Bookie, HubSpot, Stripe, Mobile Tech RX,
  Urable customer export, QuickBooks-style, Urable template, plus a column
  mapper for anything else.
- **Products/Services:** Jobber, Square catalog, Housecall Pro, Urable template
  (current + legacy single-price), tiered-variant sheets, generic services sheets.
- **Jobs:** Urable jobs export, Detail Bookie all-jobs export, Detail Bookie
  tickets.

## Exports
CSV output is clamped to the template's used range — exactly 13 columns for
customers (10 for products), no blank rows, nothing past the last column. The
Urable importer rejects files with stray columns hanging off the end.

## API facts learned against live accounts
- A line item with **no usable `priceSku` is silently mispriced** — there is no
  line-level amount override, and the API returns success. Every line must
  reference a real SKU.
- `GET /v1/products` never returns `categoryName`, only an unresolvable
  `categoryRef`, while `POST` requires a name. Category copy between accounts
  needs the source account's products export dropped in until Urable exposes it.
- Urable mints a category on first use and does **not** dedupe concurrent
  creates — create one product per new category serially, then parallelise.
- `POST /v1/payments` has **no DELETE**, and deleting a job does not remove its
  payments. Read the Payments total before re-running a migration.
- A bad token returns **400 `invalid token`**, not 401.
- Field jobs are rejected unless the customer has a location.
- Money is cents, timestamps Unix ms, pagination `startAfter` at 100/page.

## Practices worth keeping
- **Run every import twice.** The second pass is the retry mechanism and is safe
  by design — already-imported jobs are skipped by signature.
- **Verify money against the source.** Each created job's returned total is
  compared to the source subtotal and mismatches are reported.
- **Prefer a hard stop over a plausible-but-wrong result.**
- Customer-list de-duplication happens **within the file being imported** — it
  does not match against customers already in the account.

## Offline test

No keys, no account, no network — runs under plain node:

```bash
node migration-harness.test.js
```

Nine scenarios against a stubbed API: read-only preview, the copy, an idempotent
re-run, the same-account and vehicles-without-customers guards, a destination
failure being reported rather than swallowed, a lawn-care source keeping its
categories and industry, six category shapes the API might return, and the real
categoryRef-with-no-categories-endpoint case. 36 assertions.

**It loads the account-copy section straight out of `index.html`** rather than
carrying its own copy, so what it tests is what ships. Verified by removing the
source-write guard from `index.html` and watching the harness fail. If the
section is renamed or moved, the harness stops with a message instead of
silently passing — update the markers near the top of the file.

## Import run log

Every direct API import opens a run: `IMP-YYYYMMDD-HHMM-<initials>`. The operator
types their name before the run starts (self-declared, not authenticated — there
is no login on a static page, but it puts a name on the batch).

Two things come out of it:

- **A tag on the records.** The run id goes into the notes of every customer,
  vehicle and job created, so a bad batch can be found and removed in the app
  without disturbing anything else in the account.
- **A receipt.** A CSV listing every record created with its Urable id, offered
  at the end of the run. This is the only precise record of a run — keep it.
  Payments in particular have no DELETE endpoint, so the receipt is the only way
  to know exactly what a run put in.

## Jobs imports and workflows

The jobs panel carries a warning, because this bites hard: a bulk jobs import
creates hundreds of jobs at once, and any workflow or scheduled message watching
for new or completed jobs fires on every one — real messages to the shop's real
customers. Turn workflows and automated scheduled messages **off** before a jobs
run and back on after, and consider a Completed → payment-request workflow to
sweep up imported jobs that still owe money.

## Prospect-facing export request

`exports/index.html` — the page CS sends to a shop that's switching, explaining
which three exports to pull and where to find them.
Live at https://urable-import-tool.vercel.app/exports/

## Repo contents
- `index.html` — the tool
- `README.md` — this file
- `walkthrough/` — the CS walkthrough, its images, step script, and `capture.js`
- `migration-harness.test.js` — offline test for the account-to-account copy
- `exports/` — the shareable "what to send us" page for prospective customers

See `claude/START_HERE_Import_Tool.md` in the Urable project for the full
history, open threads, and the Kyle list.
