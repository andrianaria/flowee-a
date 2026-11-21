# Flowee

A compact local finance workspace adapted from Flowee source revision
`36cffdc`. It keeps CSV import, transaction management, categorization rules,
an account catalog, and profit & loss, balance sheet, cash-flow and EBITDA
reports. The application starts with clearly fictional November 2026 data.

## Run locally

Use Node.js **22.18 or newer**.

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The application binds to
localhost. No cloud account, login, environment file, API key or external
database is needed. Package installation needs internet access; normal app
operation uses local data.

## Workflows

- **Transactions:** search and filter, add or edit entries, assign accounts,
  apply tags in bulk, and remove entries.
- **CSV import:** download the synthetic sample from the import screen, map
  columns, inspect the preview, and import. Re-importing the same rows skips
  duplicates. Use fictional data in this workspace.
- **Categorization:** define prioritized matching rules and assign accounts
  or tags. Rules can be enabled, edited and applied to matching transactions.
- **Account catalog:** browse accounts and add an account for categorization.
- **Reports:** inspect four financial statements for a selected period and
  export them. The initial report period is November 2026.

## Data and accounting scope

This is a local, single-user cash-book application. Transactions record
positive IDR amounts with CREDIT for money received and DEBIT for money paid.
Only classified transactions with an assigned account enter the reports.
Revenue, expenses, asset purchases, financing and equity contributions feed
separate statement sections. The balance sheet derives retained earnings
from cumulative classified profit and loss. It is not a full accrual or
multi-currency general ledger.

A versioned store in `.data/` is created automatically on first use and persists
across server restarts. Do not commit or share that folder. Stop the server and
remove `.data/` to restore the fictional starting data on the next start.
Use only one running server against a store. There is no public hosting or
multi-user security layer in this local edition.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

Unit tests cover import parsing, validation, rule application, persistence,
period boundaries and financial statement consistency. The build checks
TypeScript errors rather than bypassing them.

For browser and API checks, install Chromium once and run:

```sh
npx playwright install chromium
npm run test:e2e
```

The browser suite starts an isolated local server on port 3107 and uses
`.data/e2e/` through the optional `FLOWEE_DATA_DIR` directory setting, keeping
the regular workspace store separate. It checks the workspace flows. It uses synthetic input only. Build output, temporary stores, browser
artifacts, dependency folders and environment files are ignored by Git.

## License

MIT. Adapted UI component notices are preserved in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
