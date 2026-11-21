import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Upload, WandSparkles, FileChartColumn, CircleCheck } from "lucide-react"
import { getState } from "@/lib/store"

export const dynamic = "force-dynamic"
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)

export default function Dashboard() {
  const state = getState()
  const transactions = state.transactions
  const classified = transactions.filter(t => t.account_id && t.status !== "pending")
  const incoming = classified.filter(t => t.transaction_type === "CREDIT").reduce((sum, t) => sum + t.amount, 0)
  const outgoing = classified.filter(t => t.transaction_type === "DEBIT").reduce((sum, t) => sum + t.amount, 0)
  const pending = transactions.filter(t => !t.account_id || t.status === "pending").length
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 7)
  const stats = [
    { label: "Saldo kas terkategori", value: money(incoming - outgoing), caption: "Seluruh periode", icon: ArrowUpRight, color: "text-blue-600 bg-blue-50" },
    { label: "Kas masuk", value: money(incoming), caption: "Transaksi terkategori", icon: ArrowDownLeft, color: "text-emerald-600 bg-emerald-50" },
    { label: "Kas keluar", value: money(outgoing), caption: "Transaksi terkategori", icon: ArrowUpRight, color: "text-amber-600 bg-amber-50" },
    { label: "Perlu ditinjau", value: String(pending), caption: "Belum masuk laporan", icon: CircleCheck, color: "text-violet-600 bg-violet-50" },
  ]
  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-blue-600">Gambaran keuangan</p><h1 className="text-3xl font-semibold tracking-tight">Semua angka, lebih jelas.</h1><p className="mt-2 text-sm text-slate-500">Kelola transaksi dan lihat ke mana uang bergerak.</p></div><Link href="/app/upload" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"><Upload className="size-4" />Import transaksi</Link></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, caption, icon: Icon, color }) => <section key={label} className="rounded-xl border border-slate-200/80 bg-white p-5"><div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-medium text-slate-500">{label}</h2><span className={`rounded-lg p-2 ${color}`}><Icon className="size-4" /></span></div><p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-2 text-xs text-slate-400">{caption}</p></section>)}</div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-5"><h2 className="font-semibold">Transaksi terbaru</h2><Link href="/app/transactions" className="flex items-center gap-1 text-xs font-medium text-blue-600">Lihat semua<ArrowRight className="size-3.5" /></Link></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50/60 text-xs text-slate-400"><tr><th className="px-5 py-3 font-medium">Transaksi</th><th className="px-4 py-3 font-medium">Tanggal</th><th className="px-4 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Jumlah</th></tr></thead><tbody>{recent.map(t => <tr key={t.id} className="border-t border-slate-100"><td className="px-5 py-4 font-medium">{t.description}</td><td className="whitespace-nowrap px-4 py-4 text-slate-500">{t.date}</td><td className="px-4 py-4"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] ${!t.account_id || t.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{!t.account_id || t.status === "pending" ? "Perlu ditinjau" : "Terkategori"}</span></td><td className={`whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums ${t.transaction_type === "CREDIT" ? "text-emerald-600" : "text-slate-700"}`}>{t.transaction_type === "CREDIT" ? "+" : "−"}{money(t.amount)}</td></tr>)}</tbody></table>{recent.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Belum ada transaksi. Mulai dengan import CSV.</p>}</div></section>
      <div className="space-y-4"><section className="rounded-xl bg-slate-900 p-6 text-white"><div className="mb-5 inline-flex rounded-lg bg-white/10 p-2"><FileChartColumn className="size-5 text-blue-300" /></div><h2 className="text-xl font-semibold tracking-tight">Dari transaksi<br />jadi keputusan.</h2><p className="mt-3 text-sm leading-relaxed text-slate-400">Laba rugi, neraca, arus kas, dan EBITDA dari transaksi yang sudah dikategorikan.</p><Link href="/app/reports" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-300">Buka laporan<ArrowRight className="size-4" /></Link></section><Link href="/app/rules" className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-5"><span className="rounded-lg bg-violet-50 p-2 text-violet-600"><WandSparkles className="size-4" /></span><span><span className="block text-sm font-semibold">Kurangi pekerjaan berulang</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">Aturan kategori mencocokkan deskripsi dan nominal secara otomatis.</span></span></Link></div>
    </div>
  </div>
}
