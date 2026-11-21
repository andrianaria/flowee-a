"use client"
import { useCallback, useEffect, useState } from "react"
import { RulesEngine } from "@/components/rules/rules-engine"
import { RuleBuilder } from "@/components/rules/rule-builder"
import type { Account, Rule } from "@/lib/ledger"
import { Notice, PageHeading, request } from "@/components/workspace/common"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Rule | null>(null)
  const load = useCallback(async () => {
    const [ruleData, accountData] = await Promise.all([request<{ rules: Rule[] }>("/api/rules"), request<{ accounts: Account[] }>("/api/accounts")])
    setRules(ruleData.rules); setAccounts(accountData.accounts)
  }, [])
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setLoading(false)) }, [load])
  const change = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(""); setMessage("")
    try { await task(); await load(); setMessage(success); return true }
    catch (e) { setError(e instanceof Error ? e.message : "Aturan gagal disimpan"); return false }
    finally { setBusy(false) }
  }
  const save = (data: { name: string; conditions: Rule["conditions"]; actions: Rule["actions"] }) => change(() => request(editing ? `/api/rules/${editing.id}` : "/api/rules", { method: editing ? "PATCH" : "POST", body: JSON.stringify(data) }), "Aturan berhasil disimpan.")
  const move = async (id: string, direction: "up" | "down") => {
    const sorted = [...rules].sort((a, b) => b.priority - a.priority)
    const index = sorted.findIndex(rule => rule.id === id), target = direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= sorted.length) return
    const order = [...sorted]; [order[index], order[target]] = [order[target], order[index]]
    await change(async () => {
      // Save a unique priority per rule, including initially tied priorities.
      for (let i = 0; i < order.length; i++) await request(`/api/rules/${order[i].id}`, { method: "PATCH", body: JSON.stringify({ priority: order.length - i }) })
    }, "Prioritas aturan diperbarui.")
  }
  return <div className="space-y-6"><PageHeading title="Aturan kategorisasi" description="Gunakan kondisi dan aksi untuk memberi kategori serta tag secara konsisten. Aturan dengan prioritas tertinggi dijalankan lebih dulu."><Button variant="outline" disabled={busy || loading} onClick={() => void change(() => request("/api/transactions/auto-tag", { method: "POST", body: JSON.stringify({}) }), "Aturan diterapkan pada transaksi yang belum dibukukan.")}><Sparkles />Jalankan aturan</Button></PageHeading><Notice message={error} error /><Notice message={message} />{loading ? <p role="status" className="p-10 text-center text-slate-500">Memuat aturan…</p> : <RulesEngine rules={rules} busy={busy} onRuleAdd={() => { setEditing(null); setOpen(true) }} onRuleEdit={rule => { setEditing(rule); setOpen(true) }} onRuleDelete={id => { if (window.confirm("Hapus aturan ini? Transaksi yang sudah dikategorikan tidak berubah.")) void change(() => request(`/api/rules/${id}`, { method: "DELETE" }), "Aturan dihapus.") }} onRuleToggle={(id, is_active) => void change(() => request(`/api/rules/${id}`, { method: "PATCH", body: JSON.stringify({ is_active }) }), "Status aturan diperbarui.")} onRulePriorityChange={(id, direction) => void move(id, direction)} />}<RuleBuilder isOpen={open} onClose={() => { setOpen(false); setEditing(null) }} onSave={save} accounts={accounts} existingRule={editing ? { name: editing.name, conditions: editing.conditions, actions: editing.actions } : undefined} /></div>
}
