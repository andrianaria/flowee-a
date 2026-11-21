"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { FileSpreadsheet, Upload, ArrowRight, Download, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { detectHeaderRow, mapImportRows, parseCSVContent, suggestColumnMapping, type ImportMapping } from "@/lib/csv-parser"
import { controlClass, currency, Notice, PageHeading, request } from "./common"
const emptyMapping: ImportMapping = { date: -1, description: -1, amount: -1, transaction_type: -1, debit: -1, credit: -1, reference: -1 }
const fields: [keyof ImportMapping, string][] = [["date", "Tanggal"], ["description", "Deskripsi"], ["amount", "Nominal"], ["transaction_type", "Jenis transaksi"], ["debit", "Debit / pengeluaran"], ["credit", "Kredit / pemasukan"], ["reference", "Referensi (opsional)"]]
export function ImportWorkspace() {
  const [data, setData] = useState<string[][]>([])
  const [headerIndex, setHeaderIndex] = useState(0)
  const [mapping, setMapping] = useState<ImportMapping>(emptyMapping)
  const [filename, setFilename] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [summary, setSummary] = useState<{ total_rows: number; new_transactions: number; duplicates: number } | null>(null)
  const headers = data[headerIndex] || []
  const sourceRows = useMemo(() => data.slice(headerIndex + 1).filter(row => row.some(cell => cell.trim())), [data, headerIndex])
  const preview = useMemo(() => mapImportRows(sourceRows, mapping), [sourceRows, mapping])
  const infer = (rows: string[][], index: number) => {
    const suggested = suggestColumnMapping(rows[index] || [])
    const next = { ...emptyMapping }
    Object.entries(suggested).forEach(([column, field]) => { if (field in next && next[field as keyof ImportMapping] < 0) next[field as keyof ImportMapping] = Number(column) })
    setMapping(next); setHeaderIndex(index)
  }
  const read = async (file?: File) => {
    if (!file) return
    setError(""); setSummary(null); setReading(true)
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Batas ukuran file 5 MB.")
      let rows: string[][]
      if (/\.xlsx$/i.test(file.name)) {
        const XLSX = await import("xlsx")
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false })
        if (!workbook.SheetNames[0]) throw new Error("Spreadsheet tidak berisi lembar kerja.")
        rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false, defval: "" }).map(row => row.map(value => String(value ?? "")))
      } else if (/\.(csv|tsv)$/i.test(file.name)) rows = parseCSVContent(await file.text())
      else throw new Error("Pilih file CSV, TSV, atau XLSX.")
      if (rows.length < 2) throw new Error("File memerlukan header dan sedikitnya satu transaksi.")
      if (rows.length > 5001) throw new Error("Batas impor adalah 5.000 transaksi per file.")
      setData(rows); setFilename(file.name); infer(rows, detectHeaderRow(rows))
    } catch (e) { setData([]); setError(e instanceof Error ? e.message : "File tidak dapat dibaca") }
    finally { setReading(false) }
  }
  const submit = async () => {
    setError(""); setBusy(true)
    try {
      const result = await request<{ summary: { total_rows: number; new_transactions: number; duplicates: number } }>("/api/upload", { method: "POST", body: JSON.stringify({ rows: preview.rows, bankAccountId: "demo-wallet" }) })
      setSummary(result.summary)
    } catch (e) { setError(e instanceof Error ? e.message : "Impor gagal") }
    finally { setBusy(false) }
  }
  return <div className="space-y-6"><PageHeading title="Impor transaksi" description="Unggah CSV atau spreadsheet, periksa pemetaan kolom, lalu masukkan transaksi ke buku lokal."><Button variant="outline" asChild><a href="/samples/transactions.csv" download><Download />Unduh contoh CSV</a></Button></PageHeading><Notice message={error} error />
    <section className="rounded-xl border bg-white p-6"><div className="flex gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileSpreadsheet /></div><div><h2 className="font-semibold">1. Pilih file</h2><p className="mt-1 text-sm leading-6 text-slate-500">CSV, TSV, atau XLSX hingga 5 MB. Gunakan data sintetis untuk demo. Tidak memerlukan nomor rekening.</p><label className="mt-4 block text-sm font-medium">File transaksi<input aria-label="File transaksi" className="mt-2 block w-full max-w-lg rounded-lg border bg-slate-50 p-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white" type="file" accept=".csv,.tsv,.xlsx" disabled={reading || busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void read(file) }} /></label>{reading && <p role="status" className="mt-3 text-sm text-slate-500">Membaca file…</p>}</div></div></section>
    {data.length > 0 && <><section className="rounded-xl border bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">2. Cocokkan kolom</h2><p className="mt-1 text-sm text-slate-500">{filename} · {sourceRows.length} baris. Pilih nominal + jenis, atau kolom debit dan kredit.</p></div><label className="text-sm">Baris header<select aria-label="Baris header" className={`${controlClass} mt-1`} value={headerIndex} onChange={e => infer(data, Number(e.target.value))}>{data.slice(0, Math.min(10, data.length - 1)).map((_, index) => <option key={index} value={index}>Baris {index + 1}</option>)}</select></label></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([field, label]) => <label key={field} className="text-sm font-medium text-slate-700">{label}<select className={`${controlClass} mt-2`} value={mapping[field]} onChange={e => { setMapping({ ...mapping, [field]: Number(e.target.value) }); setSummary(null) }}><option value={-1}>Tidak digunakan</option>{headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header || "(tanpa nama)"}</option>)}</select></label>)}</div><p className="mt-5 text-xs leading-5 text-slate-500">Tanggal: YYYY-MM-DD atau DD/MM/YYYY. Nominal: 150000, 150.000,00, atau 150,000.00 (Rupiah bulat). CREDIT/MASUK berarti pemasukan, DEBIT/KELUAR berarti pengeluaran. Tanpa kolom jenis, nominal negatif dianggap pengeluaran.</p></section>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="flex flex-wrap items-center justify-between gap-4 border-b p-6"><div><h2 className="font-semibold">3. Tinjau & impor</h2><p className="mt-1 text-sm text-slate-500">{preview.rows.length} baris valid · {preview.errors.length} kesalahan. Duplikat akan dilewati.</p></div><Button disabled={busy || preview.errors.length > 0 || preview.rows.length === 0 || !!summary} onClick={() => void submit()}><Upload />{busy ? "Mengimpor…" : "Impor transaksi"}</Button></div>{preview.errors.length > 0 && <div role="alert" className="border-b bg-amber-50 px-6 py-4 text-sm text-amber-900"><p className="font-medium">Perbaiki file atau pemetaan sebelum mengimpor.</p><ul className="mt-2 list-inside list-disc">{preview.errors.slice(0, 5).map(item => <li key={item}>{item}</li>)}</ul>{preview.errors.length > 5 && <p className="mt-1">Dan {preview.errors.length - 5} kesalahan lainnya.</p>}</div>}<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Tanggal", "Deskripsi", "Jenis", "Nominal", "Referensi"].map(label => <th key={label} className="p-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y">{preview.rows.slice(0, 8).map((row, index) => <tr key={index}><td className="whitespace-nowrap p-4">{row.date}</td><td className="min-w-48 p-4">{row.description}</td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs ${row.transaction_type === "CREDIT" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.transaction_type === "CREDIT" ? "Pemasukan" : "Pengeluaran"}</span></td><td className="whitespace-nowrap p-4 font-medium">{currency(row.amount)}</td><td className="p-4 text-slate-500">{row.reference || "—"}</td></tr>)}</tbody></table>{preview.rows.length > 8 && <p className="border-t p-4 text-center text-xs text-slate-500">Pratinjau 8 dari {preview.rows.length} baris valid.</p>}</div></section></>}
    {summary && <section role="status" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6"><div className="flex items-center gap-3"><CheckCircle2 className="text-emerald-600" /><div><h2 className="font-semibold text-emerald-900">Impor selesai</h2><p className="mt-1 text-sm text-emerald-800">{summary.new_transactions} transaksi baru · {summary.duplicates} duplikat dilewati dari {summary.total_rows} baris.</p></div></div><Button asChild><Link href="/app/transactions">Lihat transaksi<ArrowRight /></Link></Button></section>}
  </div>
}
