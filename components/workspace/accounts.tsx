"use client"

import { useEffect, useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Account } from "@/lib/ledger"
import { controlClass, Notice, PageHeading, request } from "./common"
const types = { asset: "Aset", liability: "Kewajiban", equity: "Ekuitas", revenue: "Pendapatan", expense: "Beban" }
const categories: Record<string, string> = { revenue: "Pendapatan", cogs: "Harga pokok", operating: "Operasional", depreciation: "Penyusutan", amortization: "Amortisasi", interest: "Bunga", tax: "Pajak", asset: "Aset", liability: "Kewajiban", equity: "Ekuitas" }
export function AccountsWorkspace() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ code: "", name: "", type: "expense", category: "operating" })
  useEffect(() => { request<{ accounts: Account[] }>("/api/accounts").then(data => setAccounts(data.accounts)).catch(e => setError(e.message)).finally(() => setLoading(false)) }, [])
  const visible = accounts.filter(account => `${account.code} ${account.name}`.toLowerCase().includes(search.toLowerCase()))
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("")
    try {
      await request("/api/accounts", { method: "POST", body: JSON.stringify(draft) })
      const data = await request<{ accounts: Account[] }>("/api/accounts"); setAccounts(data.accounts); setOpen(false); setMessage("Akun baru berhasil ditambahkan."); setDraft({ code: "", name: "", type: "expense", category: "operating" })
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan akun") }
    finally { setBusy(false) }
  }
  return <div className="space-y-6"><PageHeading title="Bagan akun" description="Kategori transaksi yang menyusun laba rugi, neraca, dan arus kas. Setiap akun memiliki kelompok laporan yang jelas."><Button onClick={() => setOpen(true)}><Plus />Tambah akun</Button></PageHeading><Notice message={error} error /><Notice message={message} /><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Object.entries(types).map(([type, label]) => <div key={type} className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold">{accounts.filter(account => account.type === type).length}</p></div>)}</div><section className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-4"><label className="relative block max-w-sm"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><span className="sr-only">Cari akun</span><input className={`${controlClass} pl-9`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kode atau nama akun" /></label></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs text-slate-500"><tr>{["Kode", "Nama akun", "Jenis", "Kelompok laporan"].map(label => <th className="p-4 font-medium" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{visible.map(account => <tr key={account.id}><td className="p-4 font-mono text-blue-700">{account.code}</td><td className="p-4 font-medium text-slate-800">{account.name}</td><td className="p-4 text-slate-500">{types[account.type]}</td><td className="p-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{categories[account.category || account.type] || account.category}</span></td></tr>)}</tbody></table></div>{loading ? <p role="status" className="p-8 text-center text-slate-500">Memuat akun…</p> : visible.length === 0 && <p className="p-8 text-center text-slate-500">Tidak ada akun sesuai pencarian.</p>}</section><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Tambah akun</DialogTitle><DialogDescription>Pilih kelompok yang sesuai agar transaksi masuk ke laporan yang benar.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4"><label className="block text-sm">Kode akun<input required pattern="[0-9]{3,8}" placeholder="Contoh: 6105" className={`${controlClass} mt-1`} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} /></label><label className="block text-sm">Nama akun<input required maxLength={100} className={`${controlClass} mt-1`} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label className="block text-sm">Jenis<select aria-label="Jenis akun" className={`${controlClass} mt-1`} value={draft.type} onChange={e => { const type = e.target.value; setDraft({ ...draft, type, category: type === "expense" ? "operating" : type }) }}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm">Kelompok laporan<select aria-label="Kelompok laporan" className={`${controlClass} mt-1`} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{Object.entries(categories).filter(([key]) => draft.type === "expense" ? ["cogs", "operating", "depreciation", "amortization", "interest", "tax"].includes(key) : key === draft.type).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan akun"}</Button></div></form></DialogContent></Dialog></div>
}
