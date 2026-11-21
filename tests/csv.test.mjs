import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCSVContent, detectHeaderRow, suggestColumnMapping, mapImportRows, importAmount, importDate } from '../lib/csv-parser.ts'

test('CSV parser preserves quoted delimiters and newlines without logging input', () => {
  const rows = parseCSVContent('\uFEFFdate,description,amount\r\n2026-11-01,"Demo, invoice",150000\r\n2026-11-02,"Two\nlines",200000')
  assert.equal(rows.length, 3)
  assert.equal(rows[1][1], 'Demo, invoice')
  assert.equal(rows[2][1], 'Two\nlines')
})
test('header detection and mapping retain source column positions', () => {
  const rows = parseCSVContent('Synthetic export\nTanggal,Deskripsi,Debit,Kredit\n01/11/2026,Demo expense,250000,0')
  assert.equal(detectHeaderRow(rows), 1)
  assert.deepEqual(suggestColumnMapping(rows[1]), { 0: 'date', 1: 'description', 2: 'debit', 3: 'credit' })
})
test('amount parsing supports Indonesian and international separators', () => {
  assert.equal(importAmount('Rp 1.250.000,50'), 1250000.5)
  assert.equal(importAmount('1,250,000.50'), 1250000.5)
  assert.equal(importAmount('150.000'), 150000)
  assert.equal(importAmount('(150000)'), -150000)
  assert.throws(() => importAmount('150xyz'))
})
test('date conversion rejects impossible calendar dates', () => {
  assert.equal(importDate('21/11/2026'), '2026-11-21')
  assert.equal(importDate('2026-11-01'), '2026-11-01')
  assert.throws(() => importDate('31/11/2026'))
  assert.throws(() => importDate('2026-02-29'))
})
test('debit/credit mapping rejects ambiguous or missing amounts', () => {
  const mapping = { date: 0, description: 1, amount: -1, transaction_type: -1, debit: 2, credit: 3, reference: -1 }
  const result = mapImportRows([['01/11/2026', 'Demo expense', '250.000', ''], ['02/11/2026', 'Ambiguous', '10', '20'], ['03/11/2026', 'Missing', '', '']], mapping)
  assert.deepEqual(result.rows, [{ date: '2026-11-01', description: 'Demo expense', amount: 250000, transaction_type: 'DEBIT' }])
  assert.equal(result.errors.length, 2)
})
test('signed amounts and explicit transaction directions are validated', () => {
  const mapping = { date: 0, description: 1, amount: 2, transaction_type: 3, debit: -1, credit: -1, reference: 4 }
  const result = mapImportRows([['2026-11-05', 'Demo purchase', '-500', 'DEBIT', 'DEMO-1'], ['2026-11-06', 'Conflict', '-100', 'CREDIT', '']], mapping)
  assert.equal(result.rows[0].transaction_type, 'DEBIT')
  assert.equal(result.rows[0].amount, 500)
  assert.equal(result.rows[0].reference, 'DEMO-1')
  assert.equal(result.errors.length, 1)
})

test('mapped IDR transactions reject fractional amounts before upload', () => {
  const mapping = { date: 0, description: 1, amount: 2, transaction_type: -1, debit: -1, credit: -1, reference: -1 }
  const result = mapImportRows([['2026-11-01', 'Fractional demo', '1.50']], mapping)
  assert.equal(result.rows.length, 0)
  assert.match(result.errors[0], /bilangan bulat/)
})
