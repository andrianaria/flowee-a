import type { LedgerState } from "./ledger.ts"

export type ReportType = "profit-loss" | "ebitda" | "balance-sheet" | "cash-flow"
export type ReportOptions = { type: ReportType; startDate?: string; endDate?: string }
type Account = LedgerState["accounts"][number]
type Transaction = LedgerState["transactions"][number]
type Entry = { transaction: Transaction; account: Account }
type ReportItem = { code: string; name: string; amount: number; percentage?: number }
type Section = { total: number; items: ReportItem[] }

export class ReportInputError extends Error {}

const organization = { name: "Example Demo Company" }
const reportTypes = new Set(["profit-loss", "ebitda", "balance-sheet", "cash-flow"])
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0))
const emptySection = (): Section => ({ total: 0, items: [] })

function validateDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ReportInputError(`${label} must be a valid YYYY-MM-DD date`)
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ReportInputError(`${label} must be a valid YYYY-MM-DD date`)
  }
  return value
}

function classifiedEntries(state: LedgerState): Entry[] {
  const accounts = new Map(state.accounts.map((account) => [account.id, account]))
  return state.transactions.flatMap((transaction) => {
    const account = transaction.account_id ? accounts.get(transaction.account_id) : undefined
    if (!account || !["categorized", "posted"].includes(transaction.status)) return []
    if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) return []
    return [{ transaction, account }]
  })
}

const cashAmount = ({ transaction }: Entry) => transaction.transaction_type === "CREDIT" ? transaction.amount : -transaction.amount

function category(account: Account) {
  if (account.type !== "expense") return account.type
  return account.category || "operating"
}

function sectionFor(entries: Entry[], categories: string[], normal: "credit" | "debit"): Section {
  const items = new Map<string, ReportItem>()
  for (const entry of entries) {
    if (!categories.includes(category(entry.account))) continue
    const key = entry.account.id
    const item = items.get(key) || { code: entry.account.code, name: entry.account.name, amount: 0 }
    item.amount = round(item.amount + cashAmount(entry) * (normal === "credit" ? 1 : -1))
    items.set(key, item)
  }
  const result = [...items.values()].filter((item) => item.amount !== 0).sort((a, b) => a.code.localeCompare(b.code))
  const total = sum(result.map((item) => item.amount))
  return {
    total,
    items: result.map((item) => ({ ...item, percentage: total !== 0 ? item.amount / total * 100 : 0 })),
  }
}

function profitLoss(entries: Entry[], start: string, end: string) {
  const revenue = sectionFor(entries, ["revenue"], "credit")
  const cogs = sectionFor(entries, ["cogs"], "debit")
  const operatingExpenses = sectionFor(entries, ["operating"], "debit")
  const depreciation = sectionFor(entries, ["depreciation"], "debit")
  const amortization = sectionFor(entries, ["amortization"], "debit")
  const nonOperatingExpenses = sectionFor(entries, ["interest"], "debit")
  const taxExpenses = sectionFor(entries, ["tax"], "debit")
  const expenseSections = [operatingExpenses, depreciation, amortization, nonOperatingExpenses, taxExpenses]
  const expenses = {
    total: sum(expenseSections.map((section) => section.total)),
    items: expenseSections.flatMap((section) => section.items).sort((a, b) => a.code.localeCompare(b.code)),
  }
  const operatingExpenseGroups = {
    rent: emptySection(), marketingAndPlatform: emptySection(), managementFee: emptySection(), otherOperating: emptySection(),
  }
  for (const item of operatingExpenses.items) {
    const name = item.name.toLowerCase()
    const key = /rent|sewa/.test(name) ? "rent"
      : /marketing|platform|pemasaran/.test(name) ? "marketingAndPlatform"
      : /management|manajemen/.test(name) ? "managementFee" : "otherOperating"
    operatingExpenseGroups[key].items.push(item)
    operatingExpenseGroups[key].total = round(operatingExpenseGroups[key].total + item.amount)
  }
  const grossProfit = round(revenue.total - cogs.total)
  const ebitda = round(grossProfit - operatingExpenses.total)
  const depreciationAmortization = round(depreciation.total + amortization.total)
  const ebit = round(ebitda - depreciationAmortization)
  const ebt = round(ebit - nonOperatingExpenses.total)
  const netIncome = round(ebt - taxExpenses.total)
  return {
    type: "profit-loss" as const, basis: "cash-book", period: `${start} - ${end}`,
    revenue, cogs, expenses, operatingExpenses, depreciation, amortization, nonOperatingExpenses, taxExpenses,
    operatingExpenseGroups, summary: { grossProfit, ebitda, depreciationAmortization, ebit, ebt, netIncome },
    transactionCount: entries.filter(({ account }) => account.type === "revenue" || account.type === "expense").length,
    organization,
  }
}

function ebitdaReport(entries: Entry[], start: string, end: string) {
  const report = profitLoss(entries, start, end)
  const { grossProfit, ebitda, depreciationAmortization, ebit, ebt, netIncome } = report.summary
  const margin = (amount: number) => report.revenue.total !== 0 ? amount / report.revenue.total * 100 : 0
  return {
    type: "ebitda" as const, basis: "cash-book", period: report.period, revenue: report.revenue, cogs: report.cogs,
    grossProfit, grossMargin: margin(grossProfit), operatingExpenses: report.operatingExpenses,
    operatingExpenseGroups: report.operatingExpenseGroups, ebitda, ebitdaMargin: margin(ebitda),
    depreciationAmortization, depreciation: report.depreciation.total, amortization: report.amortization.total,
    ebit, ebitMargin: margin(ebit), interest: report.nonOperatingExpenses.total,
    nonOperatingExpenses: report.nonOperatingExpenses, ebt, taxes: report.taxExpenses.total,
    netIncome, netMargin: margin(netIncome), totalExpenses: report.expenses.total,
    transactionCount: report.transactionCount, organization,
  }
}

function cashFlow(allEntries: Entry[], periodEntries: Entry[], start: string, end: string) {
  const sections = { operating: emptySection(), investing: emptySection(), financing: emptySection() }
  const grouped = new Map<string, { activity: keyof typeof sections; item: ReportItem }>()
  for (const entry of periodEntries) {
    const activity = entry.account.type === "asset" ? "investing"
      : ["liability", "equity"].includes(entry.account.type) ? "financing" : "operating"
    const key = `${activity}:${entry.account.id}`
    const row = grouped.get(key) || {
      activity, item: { code: entry.account.code, name: entry.account.name, amount: 0 },
    }
    row.item.amount = round(row.item.amount + cashAmount(entry))
    grouped.set(key, row)
  }
  for (const { activity, item } of grouped.values()) {
    if (!item.amount) continue
    sections[activity].items.push(item)
    sections[activity].total = round(sections[activity].total + item.amount)
  }
  for (const section of Object.values(sections)) section.items.sort((a, b) => a.code.localeCompare(b.code))
  const beginningCash = sum(allEntries.filter(({ transaction }) => transaction.date < start).map(cashAmount))
  const netCashFlow = sum(Object.values(sections).map((section) => section.total))
  return {
    type: "cash-flow" as const, basis: "cash-book", period: `${start} - ${end}`, ...sections,
    beginningCash, endingCash: round(beginningCash + netCashFlow), netCashFlow, organization,
  }
}

function balanceSheet(entries: Entry[], end: string) {
  const cash = sum(entries.map(cashAmount))
  const assets = {
    current: { total: cash, items: [{ code: "1000", name: "Cash and demo bank balances", amount: cash }] as ReportItem[] },
    fixed: { total: 0, grossTotal: 0, accumulatedDepreciation: 0, items: [] as ReportItem[], contraItems: [] as ReportItem[] },
    intangible: { total: 0, grossTotal: 0, accumulatedAmortization: 0, items: [] as ReportItem[], contraItems: [] as ReportItem[] },
    other: emptySection(),
  }
  for (const item of sectionFor(entries, ["asset"], "debit").items) {
    const numericCode = Number(item.code)
    const target = numericCode < 1200 ? assets.current
      : numericCode >= 1300 && numericCode < 1500 ? assets.intangible
      : numericCode >= 1200 && numericCode < 1700 ? assets.fixed : assets.other
    target.items.push(item)
    target.total = round(target.total + item.amount)
    if ("grossTotal" in target) target.grossTotal = target.total
  }
  const liabilities = { current: emptySection(), longTerm: emptySection() }
  for (const item of sectionFor(entries, ["liability"], "credit").items) {
    const target = Number(item.code) >= 2500 ? liabilities.longTerm : liabilities.current
    target.items.push(item)
    target.total = round(target.total + item.amount)
  }
  const equity = sectionFor(entries, ["equity"], "credit")
  const retainedEarnings = profitLoss(entries, "0001-01-01", end).summary.netIncome
  if (retainedEarnings) equity.items.push({ code: "3900", name: "Retained earnings", amount: retainedEarnings })
  equity.total = round(equity.total + retainedEarnings)
  const totalAssets = sum(Object.values(assets).map((section) => section.total))
  const totalLiabilities = round(liabilities.current.total + liabilities.longTerm.total)
  const liabilitiesAndEquity = round(totalLiabilities + equity.total)
  const difference = round(totalAssets - liabilitiesAndEquity)
  return {
    type: "balance-sheet" as const, basis: "cash-book", asOfDate: end, assets, liabilities, equity,
    totals: {
      assets: totalAssets, liabilities: totalLiabilities, equity: equity.total, liabilitiesAndEquity,
      difference, isBalanced: Math.abs(difference) < 0.01,
    }, organization,
  }
}

/** Cash-book reports: every classified entry records one cash receipt/payment and its category. */
export function buildReport(state: LedgerState, options: ReportOptions) {
  if (!reportTypes.has(options.type)) throw new ReportInputError("Unknown report type")
  const start = validateDate(options.startDate ?? "2026-11-01", "Start date")
  const end = validateDate(options.endDate ?? "2026-11-30", "End date")
  if (options.type !== "balance-sheet" && start > end) throw new ReportInputError("Start date must not be after end date")
  const allEntries = classifiedEntries(state).filter(({ transaction }) => transaction.date <= end)
  const periodEntries = allEntries.filter(({ transaction }) => transaction.date >= start)
  if (options.type === "profit-loss") return profitLoss(periodEntries, start, end)
  if (options.type === "ebitda") return ebitdaReport(periodEntries, start, end)
  if (options.type === "cash-flow") return cashFlow(allEntries, periodEntries, start, end)
  return balanceSheet(allEntries, end)
}
