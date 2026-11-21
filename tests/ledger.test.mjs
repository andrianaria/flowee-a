import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoState, createAccount, createTransaction, validateDate, updateTransactions, deleteTransaction, importTransactions, applyRules, saveRule, listTransactions, ValidationError } from '../lib/ledger.ts'

const row = (overrides = {}) => ({ date: '2026-11-20', description: 'Synthetic imported materials', amount: 123000, transaction_type: 'DEBIT', reference: 'EXAMPLE-IMPORT', ...overrides })

test('demo has classified capital and financing, but leaves meaningful uncategorized work', () => {
  const state = createDemoState()
  assert.ok(state.transactions.some(tx => tx.account_id === 'capital' && tx.transaction_type === 'CREDIT'))
  assert.ok(state.transactions.some(tx => tx.account_id === 'equipment' && tx.transaction_type === 'DEBIT'))
  assert.equal(listTransactions(state).stats.pending, 2)
  assert.equal(new Set(state.accounts.map(account => account.code)).size, state.accounts.length)
})

test('strict dates reject normalized invalid calendar days', () => {
  assert.equal(validateDate('2024-02-29'), '2024-02-29')
  for (const date of ['2026-02-29', '2026-11-31', '2026-13-01', '11/20/2026', '2026-1-01']) assert.throws(() => validateDate(date), ValidationError)
})

test('amount, direction, currency and category references are validated', () => {
  const state = createDemoState()
  for (const value of [0, -1, 1.2, Infinity, '', null, 'bad']) assert.throws(() => createTransaction(state, row({ amount: value })), ValidationError)
  assert.throws(() => createTransaction(state, row({ transaction_type: 'INFLOW' })), ValidationError)
  assert.throws(() => createTransaction(state, row({ currency: 'USD' })), ValidationError)
  assert.throws(() => createTransaction(state, row({ account_id: 'missing' })), ValidationError)
  const tx = createTransaction(state, row({ account_id: 'cogs' }))
  assert.equal(tx.status, 'categorized')
})

test('account types and unique codes prevent inconsistent report classifications', () => {
  const state = createDemoState()
  const account = createAccount(state, { code: '6400', name: 'Synthetic utilities', type: 'expense', category: 'operating' })
  assert.equal(account.category, 'operating')
  assert.throws(() => createAccount(state, { code: '1000', name: 'Duplicate wallet', type: 'asset' }), /reserved/)
  assert.throws(() => createAccount(state, { code: '6400', name: 'Duplicate', type: 'expense' }), ValidationError)
  assert.throws(() => createAccount(state, { code: '6401', name: 'Wrong category', type: 'revenue', category: 'asset' }), ValidationError)
})

test('bulk updates validate the whole operation before changing any rows', () => {
  const state = createDemoState()
  const before = structuredClone(state)
  assert.throws(() => updateTransactions(state, ['demo-1', 'missing'], { description: 'Should never persist' }), ValidationError)
  assert.deepEqual(state, before)
  const ids = ['demo-17', 'demo-18']
  const updated = updateTransactions(state, ids, { account_id: 'admin', tag: 'reviewed' })
  assert.equal(updated.length, 2)
  assert.ok(updated.every(tx => tx.status === 'categorized' && tx.account_id === 'admin'))
})

test('clearing classification returns the transaction to pending', () => {
  const state = createDemoState()
  const [updated] = updateTransactions(state, ['demo-3'], { account_id: null })
  assert.equal(updated.status, 'pending')
  assert.throws(() => updateTransactions(state, ['demo-3'], { status: 'posted' }), ValidationError)
})

test('CSV import deduplicates existing rows and duplicates in the same batch', () => {
  const state = createDemoState()
  const result = importTransactions(state, { rows: [row(), row()] })
  assert.deepEqual(result, { total_rows: 2, new_transactions: 1, duplicates: 1 })
  assert.deepEqual(importTransactions(state, { rows: [row()] }), { total_rows: 1, new_transactions: 0, duplicates: 1 })
})

test('an invalid later import row does not leave partial imported data', () => {
  const state = createDemoState()
  const count = state.transactions.length
  assert.throws(() => importTransactions(state, { rows: [row(), row({ date: '2026-02-30' })] }), ValidationError)
  assert.equal(state.transactions.length, count)
})

test('rule matching is case-insensitive, honors all conditions and first priority', () => {
  const state = createDemoState()
  const tx = createTransaction(state, row({ description: 'SYNTHETIC MATERIALS', reference: 'EXAMPLE-PRIORITY' }))
  saveRule(state, { name: 'Higher priority override', priority: 100, conditions: [{ field: 'description', operator: 'contains', value: 'materials' }, { field: 'amount', operator: 'greater_than', value: '100000' }], actions: [{ type: 'set_account', value: 'admin' }], is_active: true })
  applyRules(state)
  assert.equal(state.transactions.find(item => item.id === tx.id).account_id, 'admin')
  assert.equal(state.transactions.find(item => item.id === tx.id).status, 'categorized')
})

test('disabled rules and posted entries are not applied; date ranges are inclusive', () => {
  const state = createDemoState()
  state.rules = []
  const rule = saveRule(state, { name: 'Inactive', priority: 1, conditions: [{ field: 'description', operator: 'contains', value: 'materials' }], actions: [{ type: 'set_account', value: 'admin' }], is_active: false })
  assert.equal(applyRules(state), 0)
  saveRule(state, { is_active: true }, rule.id)
  updateTransactions(state, ['demo-5'], { status: 'posted' })
  assert.equal(applyRules(state, { dateFrom: '2026-11-15', dateTo: '2026-11-15' }), 1)
  assert.equal(state.transactions.find(tx => tx.id === 'demo-5').account_id, 'cogs')
  assert.equal(state.transactions.find(tx => tx.id === 'demo-17').account_id, 'admin')
})

test('invalid rules cannot create inert or unsafe conditions', () => {
  const state = createDemoState()
  assert.throws(() => saveRule(state, { name: 'No conditions', conditions: [], actions: [{ type: 'set_tag', value: 'x' }] }), ValidationError)
  assert.throws(() => saveRule(state, { name: 'Unknown field', conditions: [{ field: 'password', operator: 'contains', value: 'x' }], actions: [{ type: 'set_tag', value: 'x' }] }), ValidationError)
  assert.throws(() => saveRule(state, { name: 'Invalid numeric', conditions: [{ field: 'description', operator: 'greater_than', value: '10' }], actions: [{ type: 'set_tag', value: 'x' }] }), ValidationError)
})

test('filtering does not alter persisted state and deleting is explicit', () => {
  const state = createDemoState()
  const count = state.transactions.length
  const result = listTransactions(state, { startDate: '2026-11-15', endDate: '2026-11-16', status: 'pending' })
  assert.equal(result.transactions.length, 2)
  assert.equal(result.stats.pending, 2)
  assert.equal(state.transactions.length, count)
  deleteTransaction(state, 'demo-17')
  assert.equal(state.transactions.length, count - 1)
  assert.throws(() => deleteTransaction(state, 'missing'), ValidationError)
})
