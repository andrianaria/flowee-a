"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, ArrowUp, ArrowDown, Zap, Target } from "lucide-react"
import type { Rule } from "@/lib/ledger"

interface RulesEngineProps {
  rules: Rule[]
  busy?: boolean
  onRuleAdd: () => void
  onRuleEdit: (rule: Rule) => void
  onRuleDelete: (id: string) => void
  onRuleToggle: (id: string, is_active: boolean) => void
  onRulePriorityChange: (id: string, direction: "up" | "down") => void
}
const operators: Record<string, string> = { contains: "berisi", equals: "sama dengan", starts_with: "diawali", ends_with: "diakhiri", greater_than: ">", less_than: "<" }
const fieldLabels: Record<string, string> = { description: "Deskripsi", amount: "Nominal", transaction_type: "Jenis", bank_account_id: "Dompet" }
export function RulesEngine({ rules, busy, onRuleAdd, onRuleEdit, onRuleDelete, onRuleToggle, onRulePriorityChange }: RulesEngineProps) {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3">{[["Total aturan", rules.length, Target], ["Aturan aktif", rules.filter(rule => rule.is_active).length, Zap], ["Transaksi cocok", rules.reduce((sum, rule) => sum + rule.matches_count, 0), Target]].map(([label, value, Icon]) => { const StatIcon = Icon as typeof Target; return <Card key={String(label)}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-slate-500">{String(label)}</CardTitle><StatIcon className="size-4 text-blue-500" /></CardHeader><CardContent><p className="text-2xl font-semibold">{Number(value)}</p></CardContent></Card> })}</div><Card><CardHeader className="flex flex-wrap flex-row items-center justify-between gap-4"><div><CardTitle>Daftar aturan</CardTitle><CardDescription className="mt-2">Semua kondisi dalam satu aturan harus terpenuhi. Transaksi yang dibukukan dilewati.</CardDescription></div><Button onClick={onRuleAdd} disabled={busy}><Plus />Buat aturan</Button></CardHeader><CardContent>{sorted.length === 0 ? <div className="py-12 text-center text-slate-500"><Zap className="mx-auto mb-4 size-10 text-blue-300" /><p>Belum ada aturan. Buat aturan pertama untuk mengategorikan transaksi otomatis.</p></div> : <Table><TableHeader><TableRow>{["Prioritas", "Nama & kondisi", "Aksi", "Cocok", "Aktif", "Kelola"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{sorted.map((rule, index) => <TableRow key={rule.id} className={rule.is_active ? "" : "opacity-60"}><TableCell><div className="flex items-center gap-2"><span className="font-mono">{rule.priority}</span><div className="flex flex-col"><Button aria-label={`Naikkan prioritas ${rule.name}`} size="icon" variant="ghost" className="size-6" disabled={busy || index === 0} onClick={() => onRulePriorityChange(rule.id, "up")}><ArrowUp className="size-3" /></Button><Button aria-label={`Turunkan prioritas ${rule.name}`} size="icon" variant="ghost" className="size-6" disabled={busy || index === sorted.length - 1} onClick={() => onRulePriorityChange(rule.id, "down")}><ArrowDown className="size-3" /></Button></div></div></TableCell><TableCell className="min-w-64"><p className="font-medium">{rule.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{rule.conditions.map(condition => `${fieldLabels[condition.field] || condition.field} ${operators[condition.operator] || condition.operator} “${condition.value}”`).join(" DAN ")}</p></TableCell><TableCell className="min-w-40"><div className="flex flex-wrap gap-1">{rule.actions.map((action, i) => <Badge key={i} variant="secondary">{action.type === "set_tag" ? "Tag" : "Akun"}: {action.value}</Badge>)}</div></TableCell><TableCell>{rule.matches_count}</TableCell><TableCell><Switch aria-label={`Aktifkan ${rule.name}`} checked={rule.is_active} disabled={busy} onCheckedChange={active => onRuleToggle(rule.id, active)} /></TableCell><TableCell><div className="flex"><Button variant="ghost" size="icon" disabled={busy} aria-label={`Edit aturan ${rule.name}`} onClick={() => onRuleEdit(rule)}><Edit /></Button><Button variant="ghost" size="icon" disabled={busy} aria-label={`Hapus aturan ${rule.name}`} onClick={() => onRuleDelete(rule.id)}><Trash2 className="text-slate-400" /></Button></div></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card></div>
}
