"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, Search, Sparkles, Trash2, Pencil, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { controlClass, currency, Notice, PageHeading, request } from "./common"
import type { Account, Transaction } from "@/lib/ledger"

type Row = Transaction & { account_name?: string; account_code?: string }
type Draft = { date: string; description: string; amount: string; transaction_type: "CREDIT" | "DEBIT"; account_id: string; tag: string; reference: string }
const freshDraft = (): Draft => ({ date: "2026-11-21", description: "", amount: "", transaction_type: "DEBIT", account_id: "", tag: "", reference: "" })
const labels: Record<string, string> = { pending: "Belum dikategori", categorized: "Terkategori", posted: "Dibukukan" }

export function TransactionsWorkspace() {
  const [rows, setRows] = useState<Row[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("2026-11-01")
  const [to, setTo] = useState("2026-11-30")
  const [status, setStatus] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchAccount, setBatchAccount] = useState("")
  const [batchTag, setBatchTag] = useState("")
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(freshDraft)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const load = useCallback(async () => {
    setError("")
    try {
      const [data, catalog] = await Promise.all([request<{ transactions: Row[] }>("/api/transactions"), request<{ accounts: Account[] }>("/api/accounts")])
      setRows(data.transactions); setAccounts(catalog.accounts)
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat transaksi") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const filtered = useMemo(() => rows.filter(row => (!from || row.date >= from) && (!to || row.date <= to) && (!status || row.status === status) && `${row.description} ${row.tag || ""} ${row.reference || ""}`.toLowerCase().includes(search.toLowerCase())), [rows, from, to, status, search])
  useEffect(() => { setSelected(new Set()) }, [from, to, status, search])
  const selectedIds = [...selected].filter(id => filtered.some(row => row.id === id))
  const totals = filtered.reduce((sum, row) => ({ credit: sum.credit + (row.transaction_type === "CREDIT" ? row.amount : 0), debit: sum.debit + (row.transaction_type === "DEBIT" ? row.amount : 0) }), { credit: 0, debit: 0 })
  const mutate = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(""); setMessage("")
    try { await task(); await load(); setSelected(new Set()); setMessage(success); return true }
    catch (e) { setError(e instanceof Error ? e.message : "Perubahan gagal disimpan"); return false }
    finally { setBusy(false) }
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const payload = { ...draft, amount: Number(draft.amount), account_id: draft.account_id || null, bank_account_id: "demo-wallet", currency: "IDR", status: draft.account_id ? "categorized" : "pending" }
    const ok = await mutate(() => request(editing ? `/api/transactions/${editing}` : "/api/transactions", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) }), editing ? "Transaksi diperbarui." : "Transaksi ditambahkan.")
    if (ok) setDialog(false)
  }
  const edit = (row: Row) => { setEditing(row.id); setDraft({ date: row.date, description: row.description, amount: String(row.amount), transaction_type: row.transaction_type, account_id: row.account_id || "", tag: row.tag || "", reference: row.reference || "" }); setDialog(true) }
  const download = () => {
    const csv = ["date,description,amount,transaction_type,reference", ...filtered.map(row => [row.date, row.description, row.amount, row.transaction_type, row.reference || ""].map(value => `"${String(value).replace(/^(?=[=+\-@\t\r])/, "'").replaceAll('"', '""')}"`).join(","))].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "flowee-transactions.csv"; link.click(); URL.revokeObjectURL(url)
  }
  return <div className="space-y-6">
    <PageHeading title="Transaksi" description="Tinjau arus kas, tetapkan kategori, dan jalankan aturan pada buku transaksi Anda."><div className="flex gap-2"><Button variant="outline" onClick={download} disabled={loading}><Download />Ekspor CSV</Button><Button onClick={() => { setEditing(null); setDraft(freshDraft()); setDialog(true) }}><Plus />Tambah transaksi</Button></div></PageHeading>
    <Notice message={error} error /><Notice message={message} />
    <div className="grid gap-4 sm:grid-cols-3">{[["Pemasukan", totals.credit, "text-emerald-600"], ["Pengeluaran", totals.debit, "text-slate-800"], ["Arus kas bersih", totals.credit - totals.debit, "text-blue-600"]].map(([title, amount, cls]) => <div key={String(title)} className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">{title}</p><p className={`mt-2 text-2xl font-semibold ${cls}`}>{currency(Number(amount))}</p></div>)}</div>
    <section className="overflow-hidden rounded-xl border bg-white">
      <div className="grid gap-3 border-b p-4 md:grid-cols-[minmax(200px,1fr)_170px_170px_190px]">
        <label className="relative"><span className="sr-only">Cari transaksi</span><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input className={`${controlClass} pl-9`} placeholder="Cari deskripsi atau tag" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label className="text-xs text-slate-500">Dari<input aria-label="Tanggal mulai" className={controlClass} type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="text-xs text-slate-500">Sampai<input aria-label="Tanggal akhir" className={controlClass} type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <label className="text-xs text-slate-500">Status<select className={controlClass} value={status} onChange={e => setStatus(e.target.value)}><option value="">Semua status</option>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 px-4 py-3"><span className="text-sm text-slate-500">{filtered.length} transaksi · {selectedIds.length} dipilih</span><Button size="sm" variant="outline" disabled={busy || loading || (!!from && !!to && from > to)} onClick={() => void mutate(() => request("/api/transactions/auto-tag", { method: "POST", body: JSON.stringify({ dateFrom: from || undefined, dateTo: to || undefined }) }), "Aturan diterapkan pada transaksi yang belum dibukukan.")}><Sparkles />Jalankan aturan</Button></div>
      {selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-3 border-y bg-blue-50 p-4"><label><span className="sr-only">Kategori massal</span><select className={controlClass} value={batchAccount} onChange={e => setBatchAccount(e.target.value)}><option value="">Pilih kategori</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label><label><span className="sr-only">Tag massal</span><input className={controlClass} placeholder="Tag (opsional)" value={batchTag} onChange={e => setBatchTag(e.target.value)} /></label><Button disabled={busy || (!batchAccount && !batchTag.trim())} onClick={() => void mutate(() => request("/api/transactions", { method: "PATCH", body: JSON.stringify({ ids: selectedIds, updates: { ...(batchAccount ? { account_id: batchAccount, status: "categorized" } : {}), ...(batchTag.trim() ? { tag: batchTag.trim() } : {}) } }) }), "Kategori dan tag berhasil diperbarui.")}>Terapkan ke {selectedIds.length} transaksi</Button></div>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y bg-slate-50 text-xs text-slate-500"><tr><th className="p-4"><input type="checkbox" aria-label="Pilih semua transaksi terlihat" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={e => setSelected(e.target.checked ? new Set(filtered.map(row => row.id)) : new Set())} /></th>{["Tanggal", "Deskripsi", "Kategori", "Status", "Jumlah", "Aksi"].map(label => <th key={label} className="whitespace-nowrap p-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y">{filtered.map(row => <tr key={row.id} className="hover:bg-slate-50/70"><td className="p-4"><input type="checkbox" aria-label={`Pilih ${row.description}`} checked={selected.has(row.id)} onChange={e => setSelected(current => { const next = new Set(current); if (e.target.checked) next.add(row.id); else next.delete(row.id); return next })} /></td><td className="whitespace-nowrap p-4 text-slate-500">{row.date}</td><td className="min-w-52 p-4"><div className="font-medium text-slate-800">{row.description}</div>{row.tag && <span className="mt-1 inline-block rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{row.tag}</span>}</td><td className="min-w-48 p-4 text-slate-600">{accounts.find(account => account.id === row.account_id)?.name || "Belum dikategori"}</td><td className="whitespace-nowrap p-4"><span className={`rounded-full px-2.5 py-1 text-xs ${row.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{labels[row.status] || row.status}</span></td><td className={`whitespace-nowrap p-4 text-right font-semibold ${row.transaction_type === "CREDIT" ? "text-emerald-600" : "text-slate-800"}`}>{row.transaction_type === "CREDIT" ? "+" : "−"}{currency(row.amount)}</td><td className="p-4"><div className="flex"><Button size="icon" variant="ghost" aria-label={`Edit ${row.description}`} onClick={() => edit(row)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label={`Hapus ${row.description}`} onClick={() => setDeleting(row)}><Trash2 className="text-slate-400" /></Button></div></td></tr>)}</tbody></table>{loading ? <p role="status" className="p-10 text-center text-slate-500">Memuat transaksi…</p> : filtered.length === 0 && <p className="p-10 text-center text-slate-500">Tidak ada transaksi sesuai filter. Coba ubah tanggal atau impor CSV.</p>}</div>
    </section>
    <Dialog open={dialog} onOpenChange={setDialog}><DialogContent><DialogHeader><DialogTitle>{editing ? "Edit transaksi" : "Tambah transaksi"}</DialogTitle><DialogDescription>Masukkan transaksi dalam Rupiah. Nominal selalu positif.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4"><label className="block text-sm">Deskripsi<input required maxLength={180} className={`${controlClass} mt-1`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label><div className="grid grid-cols-2 gap-4"><label className="text-sm">Tanggal<input required type="date" className={`${controlClass} mt-1`} value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label><label className="text-sm">Nominal IDR<input required type="number" min="1" step="1" className={`${controlClass} mt-1`} value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} /></label></div><label className="block text-sm">Jenis<select aria-label="Jenis" className={`${controlClass} mt-1`} value={draft.transaction_type} onChange={e => setDraft({ ...draft, transaction_type: e.target.value as Draft["transaction_type"] })}><option value="DEBIT">Pengeluaran</option><option value="CREDIT">Pemasukan</option></select></label><label className="block text-sm">Kategori<select aria-label="Kategori" className={`${controlClass} mt-1`} value={draft.account_id} onChange={e => setDraft({ ...draft, account_id: e.target.value })}><option value="">Belum dikategori</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label><label className="block text-sm">Tag<input className={`${controlClass} mt-1`} maxLength={60} value={draft.tag} onChange={e => setDraft({ ...draft, tag: e.target.value })} /></label><label className="block text-sm">Referensi<input className={`${controlClass} mt-1`} maxLength={100} value={draft.reference} onChange={e => setDraft({ ...draft, reference: e.target.value })} /></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDialog(false)}>Batal</Button><Button disabled={busy} type="submit">{busy ? "Menyimpan…" : "Simpan transaksi"}</Button></div></form></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null) }}><DialogContent><DialogHeader><DialogTitle>Hapus transaksi?</DialogTitle><DialogDescription>Transaksi “{deleting?.description}” akan dihapus dari buku lokal dan perhitungan laporan.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>Batal</Button><Button variant="destructive" disabled={busy} onClick={async () => { if (deleting && await mutate(() => request(`/api/transactions/${deleting.id}`, { method: "DELETE" }), "Transaksi dihapus.")) setDeleting(null) }}>Hapus transaksi</Button></div></DialogContent></Dialog>
  </div>
}
