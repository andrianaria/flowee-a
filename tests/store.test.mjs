import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../lib/store.ts'
import { createTransaction } from '../lib/ledger.ts'

function withStore(callback) {
  const folder = mkdtempSync(join(tmpdir(), 'flowee-test-'))
  const filename = join(folder, 'nested', 'ledger.json')
  try { callback(createStore(filename), filename) } finally { rmSync(folder, { recursive: true, force: true }) }
}

test('a fresh local store seeds once and persists mutations across instances', () => withStore((store, filename) => {
  const initial = store.getState().transactions.length
  const tx = store.mutateState(state => createTransaction(state, { date: '2026-11-20', description: 'Synthetic persistence sample', amount: 10000, transaction_type: 'CREDIT' }))
  const reopened = createStore(filename)
  assert.equal(reopened.getState().transactions.length, initial + 1)
  assert.ok(reopened.getState().transactions.some(item => item.id === tx.id))
  store.reset()
  assert.equal(reopened.getState().transactions.length, initial)
}))

test('throwing mutation rolls back without changing the file', () => withStore((store, filename) => {
  store.getState()
  const original = readFileSync(filename, 'utf8')
  assert.throws(() => store.mutateState(state => { state.transactions.length = 0; throw new Error('Synthetic test failure') }))
  assert.equal(readFileSync(filename, 'utf8'), original)
}))

test('unsupported or malformed local data is rejected instead of silently replaced', () => withStore((store, filename) => {
  store.getState()
  writeFileSync(filename, '{"version":9,"accounts":[],"transactions":[],"rules":[]}')
  assert.throws(() => store.getState(), /local data file is invalid/)
  writeFileSync(filename, 'not-json')
  assert.throws(() => store.getState(), /local data file is invalid/)
}))
