/** Single-user cash-book domain. All amounts are whole IDR and cash direction is explicit. */
export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense"
export type AccountCategory = "revenue" | "cogs" | "operating" | "depreciation" | "amortization" | "interest" | "tax" | "asset" | "liability" | "equity"
export interface Account { id: string; code: string; name: string; type: AccountType; category: AccountCategory; is_active: boolean }
export interface Transaction {
  id: string; date: string; description: string; amount: number; transaction_type: "CREDIT" | "DEBIT";
  bank_account_id: string; currency: "IDR"; status: "pending" | "categorized" | "posted";
  account_id?: string | null; tag?: string; reference?: string;
}
export interface RuleCondition { field: string; operator: string; value: string }
export interface RuleAction { type: string; value: string }
export interface Rule {
  id: string; name: string; priority: number; conditions: RuleCondition[]; actions: RuleAction[];
  is_active: boolean; matches_count: number; created_at: string;
}
export interface LedgerState { version: 1; accounts: Account[]; transactions: Transaction[]; rules: Rule[] }
export class ValidationError extends Error { constructor(message: string) { super(message); this.name = "ValidationError" } }
const TYPES: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"]
const EXPENSE_CATEGORIES: AccountCategory[] = ["cogs", "operating", "depreciation", "amortization", "interest", "tax"]
const FIELDS = ["description", "amount", "reference", "transaction_type", "bank_account", "bank_account_id", "date"]
const OPERATORS = ["contains", "equals", "starts_with", "ends_with", "greater_than", "less_than"]
const STATUSES = ["pending", "categorized", "posted"]
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("Expected an object")
  return value as Record<string, unknown>
}
function text(value: unknown, field: string, max = 180): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ValidationError(`${field} is required (maximum ${max} characters)`)
  return value.trim()
}
export function validateDate(value: unknown, field = "date"): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError(`${field} must be YYYY-MM-DD`)
  const date = new Date(value + "T00:00:00Z")
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < "1900-01-01" || value > "2200-12-31") throw new ValidationError(`${field} is not a valid date`)
  return value
}
function amount(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") throw new ValidationError("amount must be positive whole IDR")
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result <= 0 || result > 1_000_000_000_000) throw new ValidationError("amount must be positive whole IDR, up to 1 trillion")
  return result
}
function identifier(prefix: string): string { return `${prefix}-${globalThis.crypto.randomUUID()}` }
export function createDemoState(): LedgerState {
  const accounts: Account[] = [
    ["equipment", "1500", "Equipment", "asset", "asset"],
    ["loan", "2000", "Demo financing", "liability", "liability"],
    ["capital", "3000", "Owner capital", "equity", "equity"],
    ["sales", "4000", "Product sales", "revenue", "revenue"],
    ["services", "4100", "Service revenue", "revenue", "revenue"],
    ["cogs", "5000", "Cost of goods sold", "expense", "cogs"],
    ["rent", "6100", "Space rental", "expense", "operating"],
    ["marketing", "6200", "Marketing and platform", "expense", "operating"],
    ["admin", "6300", "Office operations", "expense", "operating"],
    ["depreciation", "7100", "Depreciation", "expense", "depreciation"],
    ["amortization", "7200", "Amortization", "expense", "amortization"],
    ["interest", "8100", "Finance cost", "expense", "interest"],
    ["tax", "8200", "Tax expense", "expense", "tax"],
  ].map(([id, code, name, type, category]) => ({ id, code, name, type: type as AccountType, category: category as AccountCategory, is_active: true }))
  const rows: [string, string, number, "CREDIT" | "DEBIT", string | null][] = [
    ["2026-11-01", "Synthetic opening capital", 30_000_000, "CREDIT", "capital"],
    ["2026-11-02", "Synthetic equipment purchase", 5_000_000, "DEBIT", "equipment"],
    ["2026-11-02", "Synthetic financing receipt", 8_000_000, "CREDIT", "loan"],
    ["2026-11-03", "Demo product order A", 4_500_000, "CREDIT", "sales"],
    ["2026-11-03", "Demo materials batch A", 1_600_000, "DEBIT", "cogs"],
    ["2026-11-04", "Demo monthly space rental", 2_000_000, "DEBIT", "rent"],
    ["2026-11-05", "Demo service project A", 2_750_000, "CREDIT", "services"],
    ["2026-11-06", "Demo platform promotion", 350_000, "DEBIT", "marketing"],
    ["2026-11-07", "Demo product order B", 3_200_000, "CREDIT", "sales"],
    ["2026-11-08", "Demo materials batch B", 1_150_000, "DEBIT", "cogs"],
    ["2026-11-09", "Demo office supplies", 250_000, "DEBIT", "admin"],
    ["2026-11-10", "Synthetic financing repayment", 1_000_000, "DEBIT", "loan"],
    ["2026-11-11", "Demo finance charge", 80_000, "DEBIT", "interest"],
    ["2026-11-12", "Demo service project B", 1_800_000, "CREDIT", "services"],
    ["2026-11-13", "Demo tax payment", 120_000, "DEBIT", "tax"],
    ["2026-11-14", "Demo product order C", 2_500_000, "CREDIT", "sales"],
    ["2026-11-15", "Demo uncategorized materials", 450_000, "DEBIT", null],
    ["2026-11-16", "Demo uncategorized service", 900_000, "CREDIT", null],
  ]
  const transactions = rows.map(([date, description, amount, transaction_type, account_id], index): Transaction => ({
    id: `demo-${index + 1}`, date, description, amount, transaction_type, bank_account_id: "demo-wallet", currency: "IDR",
    status: account_id ? "categorized" : "pending", account_id, reference: `DEMO-${String(index + 1).padStart(3, "0")}`,
  }))
  const rules: Rule[] = [
    { id: "rule-materials", name: "Classify materials", priority: 90, conditions: [{ field: "description", operator: "contains", value: "materials" }], actions: [{ type: "set_account", value: "cogs" }, { type: "set_tag", value: "materials" }], is_active: true, matches_count: 0, created_at: "2026-11-01T00:00:00.000Z" },
    { id: "rule-service", name: "Classify service revenue", priority: 80, conditions: [{ field: "description", operator: "contains", value: "service" }, { field: "transaction_type", operator: "equals", value: "CREDIT" }], actions: [{ type: "set_account", value: "services" }], is_active: true, matches_count: 0, created_at: "2026-11-01T00:00:00.000Z" },
  ]
  return { version: 1, accounts, transactions, rules }
}
export function validateState(value: unknown): LedgerState {
  const state = object(value)
  if (state.version !== 1 || !Array.isArray(state.accounts) || !Array.isArray(state.transactions) || !Array.isArray(state.rules)) throw new ValidationError("Unsupported or invalid local data file")
  return state as unknown as LedgerState
}
export function createAccount(state: LedgerState, value: unknown): Account {
  const data = object(value)
  const code = text(data.code, "code", 12)
  if (code === "1000") throw new ValidationError("Code 1000 is reserved for the computed local wallet balance")
  if (!/^[A-Za-z0-9.-]+$/.test(code) || state.accounts.some(account => account.code.toLowerCase() === code.toLowerCase())) throw new ValidationError("Account code must be unique and contain letters, numbers, periods or hyphens")
  const type = data.type as AccountType
  if (!TYPES.includes(type)) throw new ValidationError("Invalid account type")
  const category = (data.category || (type === "expense" ? "operating" : type)) as AccountCategory
  if (type === "expense" ? !EXPENSE_CATEGORIES.includes(category) : category !== type) throw new ValidationError("Account category does not match its type")
  const result: Account = { id: identifier("account"), code, name: text(data.name, "name", 100), type, category, is_active: true }
  state.accounts.push(result)
  return result
}
export function validateTransaction(state: LedgerState, value: unknown, existing?: Transaction): Transaction {
  const data = object(value)
  const direction = data.transaction_type ?? existing?.transaction_type ?? "DEBIT"
  if (direction !== "CREDIT" && direction !== "DEBIT") throw new ValidationError("transaction_type must be CREDIT or DEBIT")
  const accountId = data.account_id === undefined ? existing?.account_id ?? null : data.account_id
  if (accountId !== null && (typeof accountId !== "string" || !state.accounts.some(a => a.id === accountId && a.is_active))) throw new ValidationError("Choose an existing active account")
  const status = data.status ?? (data.account_id === undefined ? existing?.status : accountId ? "categorized" : "pending") ?? (accountId ? "categorized" : "pending")
  if (typeof status !== "string" || !STATUSES.includes(status)) throw new ValidationError("Invalid status")
  if (status !== "pending" && !accountId) throw new ValidationError("Categorized and posted transactions require an account")
  const bank = data.bank_account_id ?? existing?.bank_account_id ?? "demo-wallet"
  if (bank !== "demo-wallet") throw new ValidationError("Only the local demo wallet is supported")
  if (data.currency !== undefined && data.currency !== "IDR") throw new ValidationError("Only IDR is supported")
  const optional = (key: "tag" | "reference", max: number) => {
    const value = data[key] === undefined ? existing?.[key] : data[key]
    if (value === undefined || value === null || value === "") return undefined
    return text(value, key, max)
  }
  return { id: existing?.id || identifier("tx"), date: validateDate(data.date ?? existing?.date), description: text(data.description ?? existing?.description, "description", 500), amount: amount(data.amount ?? existing?.amount), transaction_type: direction, bank_account_id: "demo-wallet", currency: "IDR", status: status as Transaction["status"], account_id: accountId as string | null, tag: optional("tag", 60), reference: optional("reference", 100) }
}
export function createTransaction(state: LedgerState, value: unknown): Transaction {
  const tx = validateTransaction(state, value)
  state.transactions.push(tx)
  return tx
}
export function updateTransactions(state: LedgerState, ids: unknown, updates: unknown): Transaction[] {
  if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || ids.some(id => typeof id !== "string")) throw new ValidationError("Choose between 1 and 1000 transactions")
  const unique = [...new Set(ids)]
  const matches = unique.map(id => {
    const current = state.transactions.find(tx => tx.id === id)
    if (!current) throw new ValidationError("Transaction not found")
    return validateTransaction(state, updates, current)
  })
  const replacements = new Map(matches.map(tx => [tx.id, tx]))
  state.transactions = state.transactions.map(tx => replacements.get(tx.id) || tx)
  return matches
}
export function deleteTransaction(state: LedgerState, id: string): void {
  if (!state.transactions.some(tx => tx.id === id)) throw new ValidationError("Transaction not found")
  state.transactions = state.transactions.filter(tx => tx.id !== id)
}
export function transactionMatches(tx: Transaction, rule: Rule): boolean {
  return rule.conditions.every(condition => {
    const raw = condition.field === "bank_account" ? "Local wallet" : tx[condition.field as keyof Transaction]
    const source = String(raw ?? "").toLowerCase()
    const target = condition.value.toLowerCase()
    switch (condition.operator) {
      case "contains": return source.includes(target)
      case "equals": return source === target
      case "starts_with": return source.startsWith(target)
      case "ends_with": return source.endsWith(target)
      case "greater_than": return Number(raw) > Number(condition.value)
      case "less_than": return Number(raw) < Number(condition.value)
      default: return false
    }
  })
}
export function saveRule(state: LedgerState, value: unknown, id?: string): Rule {
  const data = object(value)
  const existing = id ? state.rules.find(rule => rule.id === id) : undefined
  if (id && !existing) throw new ValidationError("Rule not found")
  const merged = { ...existing, ...data }
  const priority = Number(merged.priority ?? 50)
  if (!Number.isInteger(priority) || priority < 0 || priority > 1000) throw new ValidationError("Priority must be between 0 and 1000")
  if (!Array.isArray(merged.conditions) || !merged.conditions.length || merged.conditions.length > 20) throw new ValidationError("Add between 1 and 20 conditions")
  if (!Array.isArray(merged.actions) || !merged.actions.length || merged.actions.length > 10) throw new ValidationError("Add between 1 and 10 actions")
  const conditions = merged.conditions.map(value => {
    const condition = object(value)
    if (typeof condition.field !== "string" || !FIELDS.includes(condition.field)) throw new ValidationError("Unsupported rule field")
    if (typeof condition.operator !== "string" || !OPERATORS.includes(condition.operator)) throw new ValidationError("Unsupported rule operator")
    const conditionValue = text(String(condition.value ?? ""), "Condition value", 500)
    if (["greater_than", "less_than"].includes(condition.operator) && (condition.field !== "amount" || !Number.isFinite(Number(conditionValue)))) throw new ValidationError("Numeric comparisons require a valid amount")
    return { field: condition.field, operator: condition.operator, value: conditionValue }
  })
  const actions = merged.actions.map(value => {
    const action = object(value)
    if (action.type !== "set_account" && action.type !== "set_tag") throw new ValidationError("Unsupported rule action")
    const actionValue = text(String(action.value ?? ""), "Action value", 100)
    if (action.type === "set_account" && !state.accounts.some(a => a.id === actionValue && a.is_active)) throw new ValidationError("Rule account does not exist")
    return { type: action.type, value: actionValue }
  })
  if (merged.is_active !== undefined && typeof merged.is_active !== "boolean") throw new ValidationError("is_active must be a boolean")
  const result: Rule = { id: existing?.id || identifier("rule"), name: text(merged.name, "name", 120), priority, conditions, actions, is_active: merged.is_active ?? true, matches_count: 0, created_at: existing?.created_at || new Date().toISOString() }
  result.matches_count = state.transactions.filter(tx => transactionMatches(tx, result)).length
  if (existing) state.rules = state.rules.map(rule => rule.id === existing.id ? result : rule)
  else state.rules.push(result)
  return result
}
export function applyRules(state: LedgerState, options: { dateFrom?: string; dateTo?: string } = {}): number {
  if (options.dateFrom) validateDate(options.dateFrom, "dateFrom")
  if (options.dateTo) validateDate(options.dateTo, "dateTo")
  if (options.dateFrom && options.dateTo && options.dateFrom > options.dateTo) throw new ValidationError("Start date must not be after end date")
  const rules = state.rules.filter(rule => rule.is_active).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  let changed = 0
  for (const tx of state.transactions) {
    if (tx.status === "posted" || (options.dateFrom && tx.date < options.dateFrom) || (options.dateTo && tx.date > options.dateTo)) continue
    const rule = rules.find(rule => transactionMatches(tx, rule))
    if (!rule) continue
    let didChange = false
    for (const action of rule.actions) {
      if (action.type === "set_account" && tx.account_id !== action.value) { tx.account_id = action.value; didChange = true }
      if (action.type === "set_tag" && tx.tag !== action.value) { tx.tag = action.value; didChange = true }
    }
    if (tx.account_id && tx.status === "pending") { tx.status = "categorized"; didChange = true }
    if (didChange) changed++
  }
  for (const rule of state.rules) rule.matches_count = state.transactions.filter(tx => transactionMatches(tx, rule)).length
  return changed
}
function duplicateKey(tx: Transaction): string { return JSON.stringify([tx.bank_account_id, tx.date, tx.description.trim().toLowerCase(), tx.amount, tx.transaction_type, tx.reference?.trim().toLowerCase() || ""]) }
export function importTransactions(state: LedgerState, value: unknown): { total_rows: number; new_transactions: number; duplicates: number } {
  const data = object(value)
  if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > 5000) throw new ValidationError("Import between 1 and 5000 rows")
  const bank = data.bankAccountId ?? "demo-wallet"
  // Validate every row before mutating state, including later rows in a bad batch.
  const rows = data.rows.map(row => validateTransaction(state, { ...object(row), bank_account_id: bank, status: "pending", account_id: null }))
  const seen = new Set(state.transactions.map(duplicateKey))
  const additions: Transaction[] = []
  for (const row of rows) {
    const key = duplicateKey(row)
    if (seen.has(key)) continue
    seen.add(key); additions.push(row)
  }
  state.transactions.push(...additions)
  return { total_rows: rows.length, new_transactions: additions.length, duplicates: rows.length - additions.length }
}
export function listTransactions(state: LedgerState, filters: { startDate?: string; endDate?: string; bankAccountId?: string; status?: string } = {}) {
  if (filters.startDate) validateDate(filters.startDate, "startDate")
  if (filters.endDate) validateDate(filters.endDate, "endDate")
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new ValidationError("Start date must not be after end date")
  const rows = state.transactions.filter(tx => (!filters.startDate || tx.date >= filters.startDate) && (!filters.endDate || tx.date <= filters.endDate) && (!filters.bankAccountId || filters.bankAccountId === "all" || tx.bank_account_id === filters.bankAccountId) && (!filters.status || filters.status === "all" || tx.status === filters.status)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  const transactions = rows.map(tx => { const account = state.accounts.find(a => a.id === tx.account_id); return { ...tx, account_name: account?.name, account_code: account?.code, bank_account: "Local wallet" } })
  const totalIncome = rows.filter(tx => tx.transaction_type === "CREDIT").reduce((sum, tx) => sum + tx.amount, 0)
  const totalExpense = rows.filter(tx => tx.transaction_type === "DEBIT").reduce((sum, tx) => sum + tx.amount, 0)
  return { transactions, stats: { total: rows.length, pending: rows.filter(tx => tx.status === "pending").length, categorized: rows.filter(tx => tx.status === "categorized").length, posted: rows.filter(tx => tx.status === "posted").length, totalIncome, totalExpense, net: totalIncome - totalExpense } }
}
