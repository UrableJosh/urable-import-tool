# Urable Data Import Tool 

Browser-based import tool for moving a shop's existing customer, catalog, and job
history data into Urable. Single self-contained `index.html` — no backend, no
build step.

**Live URL:** _(fill in after the first Vercel deploy)_

## What it does

Three drop zones — **Customers**, **Products & Services**, **Jobs History**. Each
one converts the uploaded file, shows a preview, and then either downloads a
Urable-template CSV or imports directly through the Urable API.

Customer files are parsed entirely in the browser and never leave the machine.
Direct import uses the account's own Urable API key, entered at runtime and never
stored.

## Supported formats

**Customers** (auto-detected): Jobber · Shopmonkey · Shopmonkey Fleet · Fieldd ·
Square (two variants) · EBMS · GoHighLevel · TintWiz · Detail Bookie · HubSpot ·
Stripe · QuickBooks-style billing/shipping export · Urable template ·
jobs-export-as-customer-source. Anything else goes through the built-in column
mapper.

**Products / Services:** Urable products export · Urable import template (current
and legacy single-`Price` variant) · Jobber · Square catalog · Housecall Pro
(including the subcategory variant) · tiered-variant sheets · generic services
sheets.

**Jobs:** Urable jobs export · Detail Bookie all-jobs export.

Messy or jumbled lists that fit none of the above are handled upstream by the
`urable-customer-cleanup` skill; its output drops straight back into this tool.

## Jobs import order

Phases run in sequence and the order matters:

0. **Scan & match** — pages the whole account and matches existing records, so a
   customer import followed by a jobs import doesn't duplicate anyone. Also makes
   re-runs safe.
1. Customers (unmatched only)
2. Services
3. Vehicles
4. Jobs
5. Historical payments (`imported: true`, backdated `paidAt`)

## Options

The API panel takes the API key, the environment (production / dev), and the
industry (`vehicleCare` | `lawnCare` | `flatGlass` | `other`), plus per-import
toggles.

**Catalog toggle (jobs)** defaults to OFF: historical jobs bill against a few
generic "Imported historical service" entries with the real service names kept in
job notes, so an existing Products & Services list stays clean. Turn it ON for a
fresh account to build the catalog from history.

## Notes

- Money is handled in cents for the API; CSV output is `$X.XX` (the `PRICE_DOLLAR`
  flag switches to plain numbers). Timestamps are Unix ms.
- Multi-line jobs split the subtotal evenly across line items with the first line
  absorbing remainder cents. Job totals are exact; per-line attribution is
  approximate, because the source exports carry no per-line prices.
- CSVs decode as UTF-8 with an automatic windows-1252 fallback. XLSX files with a
  corrupt single-cell dimension are repaired on load.

## Deploying

Hosted on Vercel (team `JOSH`), auto-deploying from `main`. Editing `index.html`
and pushing is the whole update loop — Vercel rebuilds in about 20 seconds and the
team just refreshes the URL.
