"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowUpRight, LayoutDashboard, ArrowLeftRight, Upload, ListTree, WandSparkles, ChartNoAxesCombined, Database } from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { href: "/app", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/app/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/app/upload", label: "Import CSV", icon: Upload },
  { href: "/app/accounts", label: "Bagan akun", icon: ListTree },
  { href: "/app/rules", label: "Aturan kategori", icon: WandSparkles },
  { href: "/app/reports", label: "Laporan", icon: ChartNoAxesCombined },
]

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return <div className="min-h-screen bg-[#f7f8fc] text-slate-900 lg:pl-60">
    <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-60 lg:flex-col lg:border-b-0 lg:border-r">
      <Link href="/app" className="flex h-20 items-center gap-2.5 px-6" aria-label="Flowee beranda">
        <span className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white"><ArrowUpRight className="size-6" /></span>
        <span className="text-2xl font-bold tracking-tight">flowee<span className="text-blue-600">.</span></span>
      </Link>
      <div className="hidden px-6 pb-4 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400 lg:block">Workspace</div>
      <nav aria-label="Navigasi utama" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? pathname === href : pathname.startsWith(href)
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")}><Icon className="size-[18px]" />{label}</Link>
        })}
      </nav>
      <div className="m-4 mt-auto hidden rounded-xl border border-slate-100 bg-slate-50 p-4 lg:block">
        <Database className="mb-2 size-4 text-slate-400" /><p className="text-xs font-medium">Ruang kerja lokal</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Transaksi contoh fiktif. Perubahan disimpan di komputer ini.</p>
      </div>
    </aside>
    <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white px-5 sm:px-8">
      <span className="text-sm text-slate-500">Example Demo Company</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />Data fiktif</span>
    </header>
    <main id="main-content" className="mx-auto max-w-[1500px] p-5 sm:p-8">{children}</main>
  </div>
}
