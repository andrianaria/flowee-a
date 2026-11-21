import test from "node:test"
import assert from "node:assert/strict"
import { buildReport, ReportInputError } from "../lib/reporting.ts"

function fixture() {
  const rows = [
    ["capital", "3000", "Demo capital", "equity", "equity"],
    ["equipment", "1500", "Equipment", "asset", "asset"],
    ["loan", "2000", "Demo loan", "liability", "liability"],
    ["sales", "4000", "Sales", "revenue", "revenue"],
    ["cogs", "5000", "Materials", "expense", "cogs"],
    ["rent", "6100", "Space rental", "expense", "operating"],
    ["depreciation", "7100", "Depreciation", "expense", "depreciation"],
    ["amortization", "7200", "Amortization", "expense", "amortization"],
    ["interest", "8100", "Finance cost", "expense", "interest"],
    ["tax", "8200", "Tax expense", "expense", "tax"],
  ]
  const accounts = rows.map(([id, code, name, type, category]) => ({ id, code, name, type, category, is_active: true }))
  const cashRows = [
    ["2026-10-31", "capital", 1000, "CREDIT"],
    ["2026-11-01", "sales", 600, "CREDIT"],
    ["2026-11-02", "cogs", 120, "DEBIT"],
    ["2026-11-03", "rent", 80, "DEBIT"],
    ["2026-11-04", "depreciation", 20, "DEBIT"],
    ["2026-11-05", "amortization", 10, "DEBIT"],
    ["2026-11-06", "interest", 5, "DEBIT"],
    ["2026-11-07", "tax", 15, "DEBIT"],
    ["2026-11-08", "equipment", 200, "DEBIT"],
    ["2026-11-09", "loan", 300, "CREDIT"],
    ["2026-11-10", "loan", 50, "DEBIT"],
    ["2026-11-30", "sales", 100, "DEBIT"],
    ["2026-12-01", "sales", 999, "CREDIT"],
  ]
  const transactions = cashRows.map(([date, account_id, amount, transaction_type], index) => ({
    id: `synthetic-${index}`, date, account_id, amount, transaction_type,
    description: "Synthetic reporting entry", status: index % 2 ? "posted" : "categorized", currency: "IDR", bank_account_id: "demo-wallet",
  }))
  return { version: 1, accounts, transactions, rules: [] }
}

test("P&L includes inclusive period boundaries and subtracts refunds and each expense exactly once", () => {
  const report = buildReport(fixture(), { type: "profit-loss" })
  assert.equal(report.revenue.total, 500)
  assert.equal(report.cogs.total, 120)
  assert.equal(report.expenses.total, 130)
  assert.deepEqual(report.summary, {
    grossProfit: 380, ebitda: 300, depreciationAmortization: 30, ebit: 270, ebt: 265, netIncome: 250,
  })
  assert.equal(report.operatingExpenseGroups.rent.total, 80)
  assert.equal(report.transactionCount, 8)
  assert.deepEqual(report.organization, { name: "Example Demo Company" })
})

test("EBITDA bridges gross profit to net income and calculates margins from net revenue", () => {
  const report = buildReport(fixture(), { type: "ebitda" })
  assert.equal(report.grossProfit, 380)
  assert.equal(report.ebitda, 300)
  assert.equal(report.ebitdaMargin, 60)
  assert.equal(report.depreciation, 20)
  assert.equal(report.amortization, 10)
  assert.equal(report.ebit, 270)
  assert.equal(report.interest, 5)
  assert.equal(report.taxes, 15)
  assert.equal(report.netIncome, 250)
  assert.equal(report.netMargin, 50)
})

test("cash flow separates asset purchases and financing while reconciling opening to closing cash", () => {
  const report = buildReport(fixture(), { type: "cash-flow" })
  assert.equal(report.operating.total, 250)
  assert.equal(report.investing.total, -200)
  assert.equal(report.financing.total, 250)
  assert.equal(report.beginningCash, 1000)
  assert.equal(report.netCashFlow, 300)
  assert.equal(report.endingCash, 1300)
  const partial = buildReport(fixture(), { type: "cash-flow", startDate: "2026-11-10", endDate: "2026-11-30" })
  assert.equal(partial.beginningCash, 1450)
  assert.equal(partial.netCashFlow, -150)
  assert.equal(partial.endingCash, 1300)
})

test("balance sheet includes earlier capital and retained earnings and satisfies assets = liabilities + equity", () => {
  const report = buildReport(fixture(), { type: "balance-sheet" })
  assert.equal(report.assets.current.total, 1300)
  assert.equal(report.assets.fixed.total, 200)
  assert.equal(report.liabilities.current.total, 250)
  assert.equal(report.equity.total, 1250)
  assert.deepEqual(report.totals, {
    assets: 1500, liabilities: 250, equity: 1250, liabilitiesAndEquity: 1500, difference: 0, isBalanced: true,
  })
  assert.equal(report.equity.items.find((item) => item.code === "3900").amount, 250)
})

test("pending, unassigned and dangling-account transactions never affect report totals", () => {
  const state = fixture()
  const sample = state.transactions[1]
  state.transactions.push(
    { ...sample, id: "pending", status: "pending", amount: 900_000 },
    { ...sample, id: "unassigned", account_id: null, amount: 800_000 },
    { ...sample, id: "dangling", account_id: "missing-account", amount: 700_000 },
  )
  assert.equal(buildReport(state, { type: "profit-loss" }).summary.netIncome, 250)
  assert.equal(buildReport(state, { type: "cash-flow" }).endingCash, 1300)
  assert.equal(buildReport(state, { type: "balance-sheet" }).totals.assets, 1500)
})

test("empty periods produce finite zero totals and an empty balanced balance sheet", () => {
  const state = { version: 1, accounts: [], transactions: [], rules: [] }
  const report = buildReport(state, { type: "ebitda" })
  assert.equal(report.ebitdaMargin, 0)
  assert.equal(report.netMargin, 0)
  assert.equal(buildReport(state, { type: "balance-sheet" }).totals.isBalanced, true)
})

test("invalid dates, reversed periods and unknown report types are rejected", () => {
  assert.throws(() => buildReport(fixture(), { type: "profit-loss", startDate: "2026-02-30" }), ReportInputError)
  assert.throws(() => buildReport(fixture(), { type: "profit-loss", endDate: "11/30/2026" }), ReportInputError)
  assert.throws(() => buildReport(fixture(), { type: "cash-flow", startDate: "2026-12-01", endDate: "2026-11-30" }), /after end date/)
  assert.throws(() => buildReport(fixture(), { type: "unknown" }), /Unknown report type/)
})
